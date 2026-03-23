#include "game/game-core.h"
#include "game/tile-registry.h"
#include <cmath>

void GameCore::AddPlayer(const std::string &id, double x, double y, double radius)
{
  float32 fx(x), fy(y), fradius(radius);
  Point position(fx, fy);

  auto circle = std::make_unique<Circle>(position, fradius);
  auto obj = std::make_unique<GameObject>(TransformData(position), std::move(circle));
  obj->ChunkZ = 1;
  
  auto backpack = std::make_unique<Inventory>(float32(100.0), float32(5.0)); // 100 volume capacity, 5kg base weight
  obj->Inventories->EquipContainer(ContainerSlot::Backpack, std::move(backpack));

  unsigned int physId = Physics.AddObject(obj.get());
  obj->Id = id;
  obj->PhysicsId = physId;

  World.Players[id] = EntityRecord{std::move(obj), physId, fradius};
}

void GameCore::RemovePlayer(const std::string &id)
{
  auto it = World.Players.find(id);
  if (it != World.Players.end())
  {
    Physics.RemoveObject(it->second.PhysicsId);
    World.Players.erase(it);
  }
}

void GameCore::AddProp(const std::string &id, double x, double y, double radius, int32_t z)
{
  float32 fx(x), fy(y), fradius(radius);
  Point position(fx, fy);

  auto circle = std::make_unique<Circle>(position, fradius);
  auto obj = std::make_unique<GameObject>(TransformData(position), std::move(circle));
  obj->IsStaticProp = true;
  obj->ChunkZ = z;

  unsigned int physId = Physics.AddObject(obj.get());
  obj->Id = id;
  obj->PhysicsId = physId;

  World.Props[id] = EntityRecord{std::move(obj), physId, fradius};
}

void GameCore::DestroyProp(const std::string &id)
{
  auto it = World.Props.find(id);
  if (it != World.Props.end())
  {
    it->second.Object->IsPendingDestruction = true;
  }
}

void GameCore::ApplyMovement(const std::string &id, double dx, double dy, double speed)
{
  auto it = World.Players.find(id);
  if (it == World.Players.end())
    return;

  GameObject *obj = it->second.Object.get();
  obj->Transform.Position.X += float32(dx * speed);
  obj->Transform.Position.Y += float32(dy * speed);

  if (dx != 0 || dy != 0)
  {
    obj->Transform.FacingDirection.X = float32(dx);
    obj->Transform.FacingDirection.Y = float32(dy);
  }

  Circle *circle = dynamic_cast<Circle *>(obj->BoundingBox.get());
  if (circle)
  {
    circle->Center = obj->Transform.Position;
  }

  Physics.UpdateObject(it->second.PhysicsId);
}

#include "game/test-spawns.h"

void GameCore::SpawnTestChest()
{
  SpawnTestChests(*this);
}

std::string GameCore::Interact(const std::string &id)
{
  auto it = World.Players.find(id);
  if (it == World.Players.end())
    return "";

  GameObject *playerObj = it->second.Object.get();
  unsigned int focusedId = playerObj->FocusedObjectId;

  if (focusedId == 0)
    return "";

  // Find the object
  // Since we only know PhysicsId, we could iterate World.Props and World.Players
  // to find it. But we actually just need to execute logic.
  GameObject *target = nullptr;

  for (auto &pair : World.Props)
  {
    if (pair.second.PhysicsId == focusedId)
    {
      target = pair.second.Object.get();
      break;
    }
  }

  if (!target)
  {
    for (auto &pair : World.Players)
    {
      if (pair.second.PhysicsId == focusedId)
      {
        target = pair.second.Object.get();
        break;
      }
    }
  }

  if (!target || !target->Interaction)
    return "";

  // Process interaction
  std::string resultJson = "";

  switch (target->Interaction->Type)
  {
  case InteractionType::Mine:
    DestroyProp(target->Id);
    break;
  case InteractionType::Loot:
  {
    // Serialize chest inventory manually
    Inventory* inv = target->Inventories->GetContainer(ContainerSlot::MainStorage);
    std::string itemsJson = "[";
    if (inv) {
      for (size_t i = 0; i < inv->Count(); i++) {
        const ItemData* item = (*inv)[i];
        if (item) {
          if (itemsJson != "[") itemsJson += ",";
          itemsJson += "{\"name\":\"" + item->Name + "\",";
          itemsJson += "\"spriteKey\":\"" + item->SpriteKey + "\",";
          itemsJson += "\"quantity\":" + std::to_string(item->Quantity) + ",";
          itemsJson += "\"stackable\":" + std::string(item->Stackable ? "true" : "false") + "}";
        }
      }
    }
    itemsJson += "]";

    // Add Player inventory too for convenience
    Inventory* pInv = playerObj->Inventories->GetContainer(ContainerSlot::Backpack);
    std::string pItemsJson = "[";
    if (pInv) {
      for (size_t i = 0; i < pInv->Count(); i++) {
        const ItemData* item = (*pInv)[i];
        if (item) {
          if (pItemsJson != "[") pItemsJson += ",";
          pItemsJson += "{\"name\":\"" + item->Name + "\",";
          pItemsJson += "\"spriteKey\":\"" + item->SpriteKey + "\",";
          pItemsJson += "\"quantity\":" + std::to_string(item->Quantity) + ",";
          pItemsJson += "\"stackable\":" + std::string(item->Stackable ? "true" : "false") + "}";
        }
      }
    }
    pItemsJson += "]";

    resultJson = "{\"type\":\"open_loot\",\"chestId\":\"" + target->Id + "\",\"chestInventory\":" + itemsJson + ",\"playerInventory\":" + pItemsJson + "}";
    break;
  }
  case InteractionType::Talk:
    // Implementation for talking (e.g. notify client to display dialogue)
    break;
  default:
    break;
  }

  return resultJson;
}

bool GameCore::TransferItem(const std::string &playerId, const std::string &targetId, int fromContainer, int toContainer, int itemIndex)
{
  auto pIt = World.Players.find(playerId);
  if (pIt == World.Players.end()) return false;
  GameObject* playerObj = pIt->second.Object.get();

  auto cIt = World.Props.find(targetId);
  if (cIt == World.Props.end()) return false;
  GameObject* targetObj = cIt->second.Object.get();

  Inventory* pInv = playerObj->Inventories->GetContainer(static_cast<ContainerSlot>(fromContainer == 0 ? ContainerSlot::Backpack : ContainerSlot::MainStorage));
  Inventory* tInv = targetObj->Inventories->GetContainer(static_cast<ContainerSlot>(toContainer == 0 ? ContainerSlot::Backpack : ContainerSlot::MainStorage));

  // If transferring from Player To Chest
  if (fromContainer == 0 && toContainer == 1) {
    pInv = playerObj->Inventories->GetContainer(ContainerSlot::Backpack);
    tInv = targetObj->Inventories->GetContainer(ContainerSlot::MainStorage);
    if (!pInv || !tInv) return false;
    return InventoryOperator::TransferTo(*pInv, *tInv, itemIndex);
  }
  // Chest to Player
  else if (fromContainer == 1 && toContainer == 0) {
    tInv = targetObj->Inventories->GetContainer(ContainerSlot::MainStorage);
    pInv = playerObj->Inventories->GetContainer(ContainerSlot::Backpack);
    if (!pInv || !tInv) return false;
    return InventoryOperator::TransferTo(*tInv, *pInv, itemIndex);
  }

  return false;
}

void GameCore::DestroyTile(int32_t wx, int32_t wy, int32_t wz)
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

void GameCore::SetTileRegistry(const std::vector<TileDef> &registry)
{
  for (const auto &def : registry)
  {
    TileRegistry::RegisterTile(def.id, def.name, def.collide);
  }
}

void GameCore::CleanupDestroyedObjects()
{
  World.RecentlyDestroyed.clear();

  // Clean Players
  for (auto it = World.Players.begin(); it != World.Players.end();)
  {
    if (it->second.Object->IsPendingDestruction)
    {
      World.RecentlyDestroyed.push_back(it->first);
      Physics.RemoveObject(it->second.PhysicsId);
      it = World.Players.erase(it);
    }
    else
    {
      ++it;
    }
  }

  // Clean Props
  for (auto it = World.Props.begin(); it != World.Props.end();)
  {
    if (it->second.Object->IsPendingDestruction)
    {
      World.RecentlyDestroyed.push_back(it->first);
      Physics.RemoveObject(it->second.PhysicsId);
      it = World.Props.erase(it);
    }
    else
    {
      ++it;
    }
  }
}

void GameCore::Tick()
{
  for (auto& [id, player] : World.Players) {
      Physics.UpdateFocus(player.Object.get(), Point(float32(-1000000.0), float32(-1000000.0)));
  }
  Physics.Tick(World);
  CleanupDestroyedObjects();
}