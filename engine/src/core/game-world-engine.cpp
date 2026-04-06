#include <cmath>
#include "core/game-world-engine.h"
#include "core/tile-registry.h"
#include "core/test-spawns.h"
#include "net/protocol.hpp"
#include "core/components/move-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"
#include <iostream>

GameWorldEngine::GameWorldEngine()
{
  ObjectManager.SetContext(this);

  Managers.Register(std::make_unique<MoveComponentManager>());
  Managers.Register(std::make_unique<InteractableComponentManager>());
  Managers.Register(std::make_unique<InventoryComponentManager>());

  Ctx.Managers = &Managers;
  Ctx.Objects = &ObjectManager;
  Ctx.Physics = &Physics;
}

// ─── Entity Management (delegates to ObjectManager) ───
void GameWorldEngine::RemovePlayer(const uint32_t id)
{
  ObjectManager.MarkForDestruction(id);
}

uint32_t GameWorldEngine::AddProp(double x, double y, double radius, int32_t z)
{
  float32 fx(x), fy(y), fradius(radius);
  Point position(fx, fy);

  float32 fwidth(32.0), fheight(32.0);
  Point topLeft(fx - fwidth / float32(2.0), fy - fheight / float32(2.0));
  Point bottomRight(fx + fwidth / float32(2.0), fy + fheight / float32(2.0));
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);

  // Use ChestBuilder-like logic inline for generic props
  auto *obj = ObjectManager.Instantiate(position, std::move(rect));
  obj->Type = "chest";
  obj->IsStaticProp = true;
  obj->Radius = fradius;
  obj->Transform.SetZPosition(z);

  auto *inv = Ctx.GetManager<InventoryComponentManager>()->Add(obj->Id, obj);
  auto storage = std::make_unique<Inventory>(float32(500.0), float32(0.0));
  inv->Inventories->EquipContainer(ContainerSlot::MainStorage, std::move(storage));

  Ctx.GetManager<InteractableComponentManager>()->Add(
      obj->Id, obj, InteractionType::Loot, "Chest");

  return obj->Id;
}

void GameWorldEngine::DestroyProp(const uint32_t id)
{
  ObjectManager.MarkForDestruction(id);
}

void GameWorldEngine::ProcessInput(const uint32_t id, const uint8_t *data, size_t length)
{
  if (length < 1)
  {
    return;
  }

  uint8_t type = data[0];
  switch (static_cast<NETMessageType>(type))
  {
  case NETMessageType::Move:
  {
    if (length < sizeof(MovePacket))
    {
      return;
    }

    const MovePacket *pkt = reinterpret_cast<const MovePacket *>(data);
    auto *mc = Ctx.GetManager<MoveComponentManager>();
    if (mc)
      mc->Move(id, float32(pkt->dx) / float32(127), float32(pkt->dy) / float32(127), *this);
    break;
  }
  case NETMessageType::Interact:
  {
    return Interact(id);
  }
  case NETMessageType::Transfer:
  {
    if (length < sizeof(TransferPacket))
    {
      return;
    }
    const TransferPacket *pkt = reinterpret_cast<const TransferPacket *>(data);
    TransferItem(id, pkt->targetId, pkt->from, pkt->to, pkt->idx);
    break;
  }
  default:
    break;
  }
}

void GameWorldEngine::SpawnTestChest()
{
  SpawnTestChests(*this);
}

// ─── Stubbed Interact ───
void GameWorldEngine::Interact(const uint32_t id)
{
  // Stub — wire route preserved, handler is no-op
  // Will be filled in when InteractionManager is fully implemented
  return;
}

// ─── Stubbed Item Transfer ───
bool GameWorldEngine::TransferItem(const uint32_t playerId, const uint32_t targetId,
                                   int fromContainer, int toContainer, int itemIndex)
{
  // Stub — wire route preserved, handler is no-op
  return false;
}

// ─── Tile Operations ───

void GameWorldEngine::DestroyTile(int32_t wx, int32_t wy, int32_t wz)
{
  int32_t cx = static_cast<int32_t>(std::floor(static_cast<double>(wx) / CHUNK_SIZE));
  int32_t cy = static_cast<int32_t>(std::floor(static_cast<double>(wy) / CHUNK_SIZE));
  int32_t cz = static_cast<int32_t>(std::floor(static_cast<double>(wz) / CHUNK_SIZE));

  Chunk *chunk = World.GetChunkSafely(cx, cy, cz);
  if (chunk)
  {
    int32_t lx = wx % CHUNK_SIZE;
    if (lx < 0)
      lx += CHUNK_SIZE;
    int32_t ly = wy % CHUNK_SIZE;
    if (ly < 0)
      ly += CHUNK_SIZE;
    int32_t lz = wz % CHUNK_SIZE;
    if (lz < 0)
      lz += CHUNK_SIZE;

    int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    chunk->tiles[index] = 0;
    World.ChunkManager->NotifyTileChanged(wx, wy, wz);
  }
}

void GameWorldEngine::SetTileRegistry(const std::vector<TileDef> &registry)
{
  for (const auto &def : registry)
  {
    TileRegistry::RegisterTile(def.id, def.name, def.collide);
  }
}

// ─── Tick (ECS-Lite Loop) ───

void GameWorldEngine::Tick()
{
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();

  // 1. Update focus for all players (passes interactable manager for O(1) bitset check)
  for (auto &[id, entity] : ObjectManager.GetEntities())
  {
    if (!entity->IsStaticProp)
    {
      Physics.UpdateFocus(entity.get(), Point(float32(-1000000.0), float32(-1000000.0)), interactMgr);
    }
  }

  // 2. Physics Update (passes dirty set for optimized AABB tree updates)
  Physics.Tick(World.ChunkManager.get(), ObjectManager.GetDirtyIds());

  // 3. Cleanup destroyed (also removes components from all managers)
  ObjectManager.CleanupDestroyed();

  // 4. Clear dirty flags for next tick
  ObjectManager.ClearDirty();

  TickCount++;
}

// ─── Binary Snapshot Serialization ───

EntityType GameWorldEngine::ResolveEntityType(const std::string &typeStr)
{
  if (typeStr == "player")
    return EntityType::Player;
  if (typeStr == "chest")
    return EntityType::Chest;
  if (typeStr == "npc")
    return EntityType::NPC;
  return EntityType::Unknown;
}

void GameWorldEngine::WriteEntity(uint8_t *buf, size_t offset, const GameObject &obj)
{
  uint32_t numericId = obj.Id;
  int32_t rawX = obj.Transform.Position().X.raw_value();
  int32_t rawY = obj.Transform.Position().Y.raw_value();
  int32_t rawR = obj.Radius.raw_value();
  uint32_t focusId = obj.FocusedObjectId;
  uint8_t type = static_cast<uint8_t>(ResolveEntityType(obj.Type));
  int8_t cz = static_cast<int8_t>(obj.Transform.Position().Z);

  uint8_t flags = 0;
  if (obj.IsPendingDestruction)
    flags |= 0x01;

  auto *invMgr = Ctx.GetManager<InventoryComponentManager>();
  if (invMgr && invMgr->Has(obj.Id))
  {
    auto *ic = invMgr->Get(obj.Id);
    if (ic->Inventories->GetContainer(ContainerSlot::Backpack) ||
        ic->Inventories->GetContainer(ContainerSlot::MainStorage))
      flags |= 0x02;
  }

  uint8_t animState = 0;
  uint32_t colorPacked = 0;
  uint32_t reserved = 0;

  std::memcpy(buf + offset + 0, &numericId, 4);
  std::memcpy(buf + offset + 4, &rawX, 4);
  std::memcpy(buf + offset + 8, &rawY, 4);
  std::memcpy(buf + offset + 12, &rawR, 4);
  std::memcpy(buf + offset + 16, &focusId, 4);
  std::memcpy(buf + offset + 20, &type, 1);
  std::memcpy(buf + offset + 21, &cz, 1);
  std::memcpy(buf + offset + 22, &flags, 1);
  std::memcpy(buf + offset + 23, &animState, 1);
  std::memcpy(buf + offset + 24, &colorPacked, 4);
  std::memcpy(buf + offset + 28, &reserved, 4);
}

void GameWorldEngine::SerializeSnapshot()
{
  uint8_t *buf = Snapshot.GetWriteBuffer();
  size_t offset = SNAPSHOT_HEADER_SIZE;

  // Write header magic and tick
  uint32_t magic = SNAPSHOT_MAGIC;
  std::memcpy(buf + 0, &magic, 4);
  std::memcpy(buf + 4, &TickCount, 4);

  // Write all entities — count players and props separately for header
  uint16_t playerCount = 0;
  uint16_t propCount = 0;

  for (const auto &[id, entity] : ObjectManager.GetEntities())
  {
    WriteEntity(buf, offset, *entity);
    offset += ENTITY_STRIDE;

    if (entity->IsStaticProp)
    {
      propCount++;
    }
    else
    {
      playerCount++;
    }
  }

  // Write destroyed IDs
  uint16_t destroyedCount = static_cast<uint16_t>(ObjectManager.GetRecentlyDestroyed().size());
  for (const auto &dId : ObjectManager.GetRecentlyDestroyed())
  {
    std::memcpy(buf + offset, &dId, 4);
    offset += 4;
  }

  std::memcpy(buf + 8, &playerCount, 2);
  std::memcpy(buf + 10, &propCount, 2);
  std::memcpy(buf + 12, &destroyedCount, 2);
  uint16_t reservedPad = 0;
  std::memcpy(buf + 14, &reservedPad, 2);
}