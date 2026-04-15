#include <cmath>
#include <cstdlib>
#include "core/game-world-engine.h"
#include "core/gameplay-constants.h"
#include "core/tile-registry.h"
#include "core/test-spawns.h"
#include "core/components/active-attack-component.h"
#include "core/components/combat-body-component.h"
#include "core/components/combat-state-component.h"
#include "core/components/dropped-item-component.h"
#include "net/protocol.hpp"
#include "core/components/equipment-component.h"
#include "core/components/move-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"

namespace
{
uint8_t QuantizeFacingSector(const Point &facing)
{
  const float32 zero = float32(0);
  const float32 absX = facing.X < zero ? zero - facing.X : facing.X;
  const float32 absY = facing.Y < zero ? zero - facing.Y : facing.Y;

  if (absX == zero && absY == zero)
    return 0;

  if (absX * float32(2) < absY)
    return facing.Y >= zero ? 0 : 4;

  if (absY * float32(2) < absX)
    return facing.X >= zero ? 2 : 6;

  if (facing.X >= zero && facing.Y >= zero)
    return 1;
  if (facing.X >= zero && facing.Y < zero)
    return 3;
  if (facing.X < zero && facing.Y < zero)
    return 5;
  return 7;
}
}

GameWorldEngine::GameWorldEngine()
{
  ObjectManager.SetContext(this);

  Managers.Register(std::make_unique<MoveComponentManager>());
  Managers.Register(std::make_unique<CombatBodyComponentManager>());
  Managers.Register(std::make_unique<CombatStateComponentManager>());
  Managers.Register(std::make_unique<ActiveAttackComponentManager>());
  Managers.Register(std::make_unique<InteractableComponentManager>());
  Managers.Register(std::make_unique<InventoryComponentManager>());
  Managers.Register(std::make_unique<EquipmentComponentManager>());
  Managers.Register(std::make_unique<DroppedItemComponentManager>());

  Ctx.Managers = &Managers;
  Ctx.Objects = &ObjectManager;
  Ctx.Physics = &Physics;
}

// ─── Entity Management (delegates to ObjectManager) ───
void GameWorldEngine::RemovePlayer(const uint32_t id)
{
  Players.RemovePlayer(*this, id);
}

uint32_t GameWorldEngine::AddProp(double x, double y, double radius, int32_t z)
{
  return Props.AddChest(*this, Point(float32(x), float32(y), z), float32(radius), z);
}

void GameWorldEngine::DestroyProp(const uint32_t id)
{
  Props.DestroyProp(*this, id);
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
      mc->Move(id, float32(pkt->dx) / float32(127), float32(pkt->dy) / float32(127));
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
  case NETMessageType::Attack:
  {
    if (length < sizeof(AttackPacket))
    {
      return;
    }

    const AttackPacket *pkt = reinterpret_cast<const AttackPacket *>(data);
    StartAttack(id, static_cast<AttackDirection>(pkt->direction));
    break;
  }
  case NETMessageType::Block:
  {
    if (length < sizeof(BlockPacket))
    {
      return;
    }

    const BlockPacket *pkt = reinterpret_cast<const BlockPacket *>(data);
    SetBlockState(id, pkt->active != 0, static_cast<BlockDirection>(pkt->direction));
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
  auto *source = ObjectManager.GetById(id);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  if (!source || !interactMgr)
    return;

  const uint32_t targetId = source->FocusedObjectId;
  if (targetId == 0)
    return;

  if (!interactMgr->CanInteract(id, targetId))
    source->FocusedObjectId = 0;
}

// ─── Stubbed Item Transfer ───
bool GameWorldEngine::TransferItem(const uint32_t playerId, const uint32_t targetId,
                                   int fromContainer, int toContainer, int itemIndex)
{
  if (fromContainer < 0 || fromContainer >= static_cast<int>(ContainerSlot::Count) ||
      toContainer < 0 || toContainer >= static_cast<int>(ContainerSlot::Count) ||
      itemIndex < 0)
  {
    return false;
  }

  auto *player = ObjectManager.GetById(playerId);
  auto *target = ObjectManager.GetById(targetId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  if (!player || !target || !interactMgr || !inventoryMgr)
    return false;

  if (!interactMgr->CanInteract(playerId, targetId))
    return false;

  const auto fromSlotEnum = static_cast<ContainerSlot>(fromContainer);
  const auto toSlotEnum = static_cast<ContainerSlot>(toContainer);
  const uint32_t fromEntityId = fromSlotEnum == ContainerSlot::Backpack ? playerId : targetId;
  const uint32_t toEntityId = toSlotEnum == ContainerSlot::Backpack ? playerId : targetId;

  return inventoryMgr->TransferItem(
      fromEntityId,
      toEntityId,
      fromSlotEnum,
      toSlotEnum,
      static_cast<size_t>(itemIndex));
}

bool GameWorldEngine::ToggleEquipItem(uint32_t entityId, int itemIndex)
{
  if (itemIndex < 0)
    return false;

  auto *player = ObjectManager.GetById(entityId);
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *equipmentMgr = Ctx.GetManager<EquipmentComponentManager>();
  if (!player || !inventoryMgr || !equipmentMgr)
    return false;

  return equipmentMgr->ToggleEquip(entityId, static_cast<size_t>(itemIndex), inventoryMgr, player);
}

bool GameWorldEngine::DropItem(uint32_t entityId, int itemIndex)
{
  if (itemIndex < 0)
    return false;

  auto *player = ObjectManager.GetById(entityId);
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  if (!player || !inventoryMgr)
    return false;

  auto item = inventoryMgr->RemoveItem(entityId, ContainerSlot::Backpack, static_cast<size_t>(itemIndex));
  if (!item)
    return false;

  const float32 spread = player->Radius * ITEM_DROP_SPREAD_RADIUS_FACTOR;
  const float32 rx = (float32(std::rand()) / float32(RAND_MAX)) * float32(2.0) - float32(1.0);
  const float32 ry = (float32(std::rand()) / float32(RAND_MAX)) * float32(2.0) - float32(1.0);
  Point dropPos(
      player->Transform.Position().X + rx * spread,
      player->Transform.Position().Y + ry * spread,
      player->Transform.Position().Z);

  Props.AddDroppedItem(*this, dropPos, std::move(item));
  return true;
}

bool GameWorldEngine::PickupItem(uint32_t playerId, uint32_t targetId)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *target = ObjectManager.GetById(targetId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *droppedMgr = Ctx.GetManager<DroppedItemComponentManager>();
  if (!player || !target || !interactMgr || !inventoryMgr || !droppedMgr)
    return false;

  if (!interactMgr->CanInteract(playerId, targetId))
    return false;

  auto *backpack = inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack);
  auto *worldItem = droppedMgr->GetItem(targetId);
  if (!backpack || !worldItem || !backpack->CanAccept(*worldItem))
    return false;

  auto item = droppedMgr->TakeItem(targetId);
  if (!item)
    return false;

  if (!backpack->AddItem(std::move(item)))
    return false;

  ObjectManager.MarkForDestruction(targetId);
  return true;
}

bool GameWorldEngine::StartAttack(uint32_t entityId, AttackDirection direction)
{
  auto *attackMgr = Ctx.GetManager<ActiveAttackComponentManager>();
  auto *bodyMgr = Ctx.GetManager<CombatBodyComponentManager>();
  auto *stateMgr = Ctx.GetManager<CombatStateComponentManager>();
  if (!attackMgr || !bodyMgr)
    return false;
  return attackMgr->StartAttack(entityId, direction, bodyMgr, stateMgr, *this);
}

bool GameWorldEngine::SetBlockState(uint32_t entityId, bool active, BlockDirection direction)
{
  auto *stateMgr = Ctx.GetManager<CombatStateComponentManager>();
  auto *bodyMgr = Ctx.GetManager<CombatBodyComponentManager>();
  if (!stateMgr || !bodyMgr)
    return false;
  return stateMgr->SetBlockState(entityId, active, direction, bodyMgr);
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
    TileRegistry::RegisterTile(def.id, def.name, def.gameplay);
  }
}

// ─── Tick (ECS-Lite Loop) ───

void GameWorldEngine::Tick()
{
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *combatBodyMgr = Ctx.GetManager<CombatBodyComponentManager>();
  auto *combatStateMgr = Ctx.GetManager<CombatStateComponentManager>();
  auto *attackMgr = Ctx.GetManager<ActiveAttackComponentManager>();

  // 1. Update focus for all players (passes interactable manager for O(1) bitset check)
  for (auto &[id, entity] : ObjectManager.GetEntities())
  {
    if (!entity->IsStaticProp)
    {
      Physics.UpdateFocus(entity.get(), Point(FOCUS_QUERY_OFFSCREEN_COORD, FOCUS_QUERY_OFFSCREEN_COORD), interactMgr);
    }
  }

  // 2. Physics Update (passes dirty set for optimized AABB tree updates)
  Physics.Tick(World.ChunkManager.get(), ObjectManager.GetDirtyIds());

  // 3. Resolve discrete layer transitions after XY collision. The entity is still on exactly one layer.
  Layers.Tick(*this);

  // 4. Resolve combat using the post-physics transforms for this server tick.
  if (attackMgr && combatBodyMgr)
  {
    attackMgr->Tick(*this, combatBodyMgr, combatStateMgr);
  }

  // 5. Cleanup destroyed (also removes components from all managers)
  ObjectManager.CleanupDestroyed();

  // 6. Clear dirty flags for next tick
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
  if (typeStr == "item_drop")
    return EntityType::ItemDrop;
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
    if (invMgr->GetContainer(obj.Id, ContainerSlot::Backpack) ||
        invMgr->GetContainer(obj.Id, ContainerSlot::MainStorage))
      flags |= 0x02;
  }

  auto *combatBodyMgr = Ctx.GetManager<CombatBodyComponentManager>();
  if (combatBodyMgr && combatBodyMgr->Has(obj.Id))
  {
    uint8_t bsv6 = static_cast<uint8_t>(combatBodyMgr->GetBodyStateVersion(obj.Id) & 0x3F);
    flags |= static_cast<uint8_t>(bsv6 << 2);
  }

  uint8_t animState = QuantizeFacingSector(obj.Transform.FacingDirection()) & 0x07;
  uint32_t colorPacked = 0;
  uint32_t reserved = 0;

  auto *attackMgr = Ctx.GetManager<ActiveAttackComponentManager>();
  auto *combatStateMgr = Ctx.GetManager<CombatStateComponentManager>();
  auto *attack = attackMgr ? attackMgr->Get(obj.Id) : nullptr;
  auto *combatState = combatStateMgr ? combatStateMgr->Get(obj.Id) : nullptr;

  uint8_t attackDirection = 0;
  uint8_t visualTrackId = 0;
  uint8_t attackTickIndex = 0;
  uint8_t attackEpoch = 0;
  uint8_t blockDirection = 0;
  uint8_t visualFlags = 0;

  if (attack && attack->Active)
  {
    attackDirection = static_cast<uint8_t>(attack->Direction);
    visualTrackId = attackDirection;
    attackTickIndex = attack->TickIndex;
    attackEpoch = static_cast<uint8_t>(attack->Epoch & 0xff);
    visualFlags |= 0x01;
  }

  if (combatState && combatState->Blocking)
  {
    blockDirection = static_cast<uint8_t>(combatState->ActiveBlock);
    visualFlags |= 0x02;
  }

  reserved = (static_cast<uint32_t>(attackDirection & 0x0f)) |
             (static_cast<uint32_t>(visualTrackId & 0x0f) << 4) |
             (static_cast<uint32_t>(attackTickIndex) << 8) |
             (static_cast<uint32_t>(attackEpoch) << 16) |
             (static_cast<uint32_t>(blockDirection & 0x07) << 24) |
             (static_cast<uint32_t>(visualFlags & 0x1f) << 27);

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

// ─── Body-State Manifest Serialization ───

std::vector<uint8_t> GameWorldEngine::SerializeBodyStateManifest()
{
  auto *bodyMgr = Managers.Get<CombatBodyComponentManager>();
  if (!bodyMgr)
  {
    BodyStateManifestHeader header;
    std::vector<uint8_t> empty(sizeof(header), 0);
    std::memcpy(empty.data(), &header, sizeof(header));
    return empty;
  }

  std::vector<BodyStateManifestEntry> entries;
  for (const auto &[id, entity] : ObjectManager.GetEntities())
  {
    if (!bodyMgr->Has(id))
      continue;

    const auto *component = bodyMgr->Get(id);
    if (!component)
      continue;

    BodyStateManifestEntry entry;
    entry.entityId = id;
    entry.bodyStateVersion = component->BodyStateVersion;
    entry.shieldState = static_cast<uint8_t>(
        ComputeShieldVisualState(component->Parts[CombatRigContract::Shield.PartId]));
    entry.functionalFlags = component->FunctionalStateFlags;
    entry.disabledParts = bodyMgr->GetDisabledPartsMask(id);
    entry.hiddenParts = bodyMgr->GetHiddenPartsMask(id);
    entries.push_back(entry);
  }

  BodyStateManifestHeader header;
  header.entityCount = static_cast<uint16_t>(entries.size());

  std::vector<uint8_t> bytes(sizeof(header) + entries.size() * sizeof(BodyStateManifestEntry), 0);
  std::memcpy(bytes.data(), &header, sizeof(header));
  if (!entries.empty())
  {
    std::memcpy(bytes.data() + sizeof(header), entries.data(),
                entries.size() * sizeof(BodyStateManifestEntry));
  }
  return bytes;
}

std::vector<uint8_t> GameWorldEngine::SerializeEntityBodyState(uint32_t entityId)
{
  auto *bodyMgr = Managers.Get<CombatBodyComponentManager>();
  BodyStateManifestHeader header;

  if (!bodyMgr || !bodyMgr->Has(entityId))
  {
    std::vector<uint8_t> empty(sizeof(header), 0);
    std::memcpy(empty.data(), &header, sizeof(header));
    return empty;
  }

  const auto *component = bodyMgr->Get(entityId);
  if (!component)
  {
    std::vector<uint8_t> empty(sizeof(header), 0);
    std::memcpy(empty.data(), &header, sizeof(header));
    return empty;
  }

  BodyStateManifestEntry entry;
  entry.entityId = entityId;
  entry.bodyStateVersion = component->BodyStateVersion;
  entry.shieldState = static_cast<uint8_t>(
      ComputeShieldVisualState(component->Parts[CombatRigContract::Shield.PartId]));
  entry.functionalFlags = component->FunctionalStateFlags;
  entry.disabledParts = bodyMgr->GetDisabledPartsMask(entityId);
  entry.hiddenParts = bodyMgr->GetHiddenPartsMask(entityId);

  header.entityCount = 1;

  std::vector<uint8_t> bytes(sizeof(header) + sizeof(entry), 0);
  std::memcpy(bytes.data(), &header, sizeof(header));
  std::memcpy(bytes.data() + sizeof(header), &entry, sizeof(entry));
  return bytes;
}
