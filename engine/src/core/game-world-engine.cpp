#include <array>
#include <cmath>
#include <cstdlib>
#include "core/game-world-engine.h"
#include "core/gameplay-constants.h"
#include "core/tile-registry.h"
#include "core/test-spawns.h"
#include "core/crafting/material-processing.h"
#include "core/components/active-attack-component.h"
#include "core/components/combat-body-component.h"
#include "core/components/combat-state-component.h"
#include "core/components/crafting-station-component.h"
#include "core/components/dropped-item-component.h"
#include "core/constants.h"
#include "net/protocol.hpp"
#include "core/components/equipment-component.h"
#include "core/components/move-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"
#include "core/tool-interaction.h"

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

const Item *FindEquippedMiningTool(EquipmentComponentManager *equipmentMgr, uint32_t entityId)
{
  if (!equipmentMgr)
    return nullptr;

  const Item *primary = equipmentMgr->GetEquippedItem(entityId, EquipSlot::HandPrimary);
  if (primary && primary->GetFeature<ToolFeature>())
    return primary;

  const Item *secondary = equipmentMgr->GetEquippedItem(entityId, EquipSlot::HandSecondary);
  if (secondary && secondary->GetFeature<ToolFeature>())
    return secondary;

  return nullptr;
}

const Item *FindEquippedCombatItem(EquipmentComponentManager *equipmentMgr, uint32_t entityId)
{
  if (!equipmentMgr)
    return nullptr;

  const Item *primary = equipmentMgr->GetEquippedItem(entityId, EquipSlot::HandPrimary);
  if (primary)
    return primary;

  return equipmentMgr->GetEquippedItem(entityId, EquipSlot::HandSecondary);
}

CraftingStationSlot *ResolveSlot(CraftingStationComponentManager *stationMgr, CraftingStationComponent *station, const std::string &requestedSlotId)
{
  if (!stationMgr || !station)
    return nullptr;
  if (!requestedSlotId.empty())
    return stationMgr->FindSlot(station, requestedSlotId);
  return stationMgr->FindFirstOpenSlot(station);
}

const CraftingStationSlot *ResolveSlot(const CraftingStationComponentManager *stationMgr, const CraftingStationComponent *station, const std::string &requestedSlotId)
{
  if (!stationMgr || !station)
    return nullptr;
  if (!requestedSlotId.empty())
    return stationMgr->FindSlot(station, requestedSlotId);
  return nullptr;
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
  Managers.Register(std::make_unique<CraftingStationComponentManager>());

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

bool GameWorldEngine::DeliverTerrainReward(uint32_t playerId, int32_t tileX, int32_t tileY, const TerrainStageRewardGrant &reward, size_t rewardIndex)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  if (!player)
    return false;

  auto item = ItemFactory::CreateByDefinitionId(reward.ItemDefinitionId, reward.Quantity);
  if (!item)
    return false;

  if (inventoryMgr && inventoryMgr->AddItem(playerId, ContainerSlot::Backpack, std::move(item), player))
    return true;

  auto dropped = ItemFactory::CreateByDefinitionId(reward.ItemDefinitionId, reward.Quantity);
  if (!dropped)
    return false;

  static const std::array<Point, 8> offsets = {
      Point(float32(0), float32(0)),
      Point(float32(8), float32(0)),
      Point(float32(-8), float32(0)),
      Point(float32(0), float32(8)),
      Point(float32(0), float32(-8)),
      Point(float32(8), float32(8)),
      Point(float32(-8), float32(8)),
      Point(float32(8), float32(-8)),
  };

  const Point &offset = offsets[rewardIndex % offsets.size()];
  const Point dropPosition(
      float32(tileX) * TILE_SIZE + (TILE_SIZE / float32(2)) + offset.X,
      float32(tileY) * TILE_SIZE + (TILE_SIZE / float32(2)) + offset.Y,
      player->Transform.Position().Z);
  Props.AddDroppedItem(*this, dropPosition, std::move(dropped));
  return true;
}

bool GameWorldEngine::MineTile(uint32_t playerId, int32_t tileX, int32_t tileY)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *equipmentMgr = Ctx.GetManager<EquipmentComponentManager>();
  if (!player)
    return false;

  const int32_t targetZ = player->Transform.Position().Z;
  const uint16_t baseTileId = World.ChunkManager->GetBaseTileAt(tileX, tileY, targetZ);
  const TileDestructionDef *destruction = TileRegistry::GetTileDestruction(baseTileId);
  if (!destruction || !destruction->Destructible)
    return false;

  const float32 tileCenterX = float32(tileX) * TILE_SIZE + (TILE_SIZE / float32(2));
  const float32 tileCenterY = float32(tileY) * TILE_SIZE + (TILE_SIZE / float32(2));
  const float32 dx = tileCenterX - player->Transform.Position().X;
  const float32 dy = tileCenterY - player->Transform.Position().Y;
  if ((dx * dx) + (dy * dy) > (PLAYER_DEFAULT_MINING_RADIUS * PLAYER_DEFAULT_MINING_RADIUS))
    return false;

  const Item *toolItem = FindEquippedMiningTool(equipmentMgr, playerId);
  const ToolFeature *toolFeature = toolItem ? toolItem->GetFeature<ToolFeature>() : nullptr;
  const int32_t damage = ResolveMiningDamage(
      toolFeature ? &toolFeature->Mining : nullptr,
      MiningTileProfile{
          destruction->StrengthClass,
          destruction->PreferredTool,
          destruction->MiningResistance,
      });

  TerrainDamageResult result = World.ChunkManager->ApplyTileDamage(tileX, tileY, targetZ, damage);
  if (!result.StateChanged && result.Rewards.empty())
    return false;

  for (size_t i = 0; i < result.Rewards.size(); ++i)
  {
    DeliverTerrainReward(playerId, tileX, tileY, result.Rewards[i], i);
  }

  return true;
}

bool GameWorldEngine::InsertItemIntoStation(uint32_t playerId, uint32_t stationId, int itemIndex, const std::string &slotId)
{
  if (itemIndex < 0)
    return false;

  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *backpack = inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack);
  if (!backpack)
    return false;

  const Item *item = (*backpack)[static_cast<size_t>(itemIndex)];
  if (!item || !Crafting::IsCraftingCapableItem(*item))
  {
    stationMgr->SetError(stationComponent, "Only crafting-capable items can be inserted into a station.");
    return false;
  }

  auto *slot = ResolveSlot(stationMgr, stationComponent, slotId);
  if (!slot || slot->Role == "output" || slot->ItemRef)
  {
    stationMgr->SetError(stationComponent, "That station slot is not available.");
    return false;
  }

  auto removed = inventoryMgr->RemoveItem(playerId, ContainerSlot::Backpack, static_cast<size_t>(itemIndex));
  if (!removed)
    return false;
  slot->ItemRef = std::move(removed);
  return true;
}

bool GameWorldEngine::RemoveItemFromStation(uint32_t playerId, uint32_t stationId, const std::string &slotId)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  if (stationComponent->StationType == CraftingStationType::Smelter)
    stationComponent->HeatingActive = false;

  CraftingStationSlot *slot = nullptr;
  if (!slotId.empty())
    slot = stationMgr->FindSlot(stationComponent, slotId);
  else
  {
    for (auto &candidate : stationComponent->Slots)
    {
      if (candidate.ItemRef)
      {
        slot = &candidate;
        break;
      }
    }
  }

  if (!slot || !slot->ItemRef)
  {
    stationMgr->SetError(stationComponent, "There is no station item in that slot.");
    return false;
  }

  auto *backpack = inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack);
  if (!backpack || !backpack->AddItem(std::move(slot->ItemRef)))
  {
    stationMgr->SetError(stationComponent, "Your backpack cannot accept that item.");
    return false;
  }

  return true;
}

bool GameWorldEngine::StartHeating(uint32_t playerId, uint32_t stationId)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Smelter)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  bool hasInput = false;
  for (const auto &slot : stationComponent->Slots)
  {
    if (slot.Role == "input" && slot.ItemRef)
    {
      hasInput = true;
      break;
    }
  }

  if (!hasInput)
  {
    stationMgr->SetError(stationComponent, "Insert one or more items into smelter input slots first.");
    return false;
  }

  stationComponent->HeatingActive = true;
  return true;
}

bool GameWorldEngine::CollectSmeltResult(uint32_t playerId, uint32_t stationId, const std::string &slotId)
{
  return RemoveItemFromStation(playerId, stationId, slotId);
}

bool GameWorldEngine::CastWorkpiece(uint32_t playerId, uint32_t stationId, MoldSilhouette silhouette, int32_t width, int32_t length, int32_t thicknessRaw)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Smelter)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  stationComponent->LastMold = silhouette;
  auto *output = stationMgr->FindSlot(stationComponent, "output");
  if (!output || output->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Collect the existing smelter result before casting again.");
    return false;
  }

  if (!stationComponent->MoltenPool.Active || stationComponent->MoltenPool.Material == MaterialId::None)
  {
    stationMgr->SetError(stationComponent, "There is no molten pool ready for casting.");
    return false;
  }

  const int32_t neededUnits = (std::max)(2, width) * (std::max)(2, length) * (std::max)(1, thicknessRaw / 65536);
  if (stationComponent->MoltenPool.AmountUnits < neededUnits)
  {
    stationMgr->SetError(stationComponent, "The molten pool is too small for that cast.");
    return false;
  }

  auto castItem = std::make_unique<Item>(
      "crafting.cast_result",
      "Cast Blank",
      "stone",
      float32(1),
      float32(1),
      false,
      1,
      1);
  WorkpieceState state = Crafting::MakeStockWorkpiece(
      stationComponent->MoltenPool.Material,
      (std::max)(2, width),
      (std::max)(2, length),
      thicknessRaw,
      silhouette == MoldSilhouette::ShaftBlank ? PartOrientation::Vertical : PartOrientation::Horizontal);
  state.Stage = WorkpieceStage::HeatedStock;
  state.TemperatureRaw = stationComponent->MoltenPool.TemperatureRaw;
  state.Quality = stationComponent->MoltenPool.Quality;
  castItem->AddFeature<WorkpieceFeature>(state);
  Crafting::Cast(*castItem, silhouette, width, length, thicknessRaw);
  output->ItemRef = std::move(castItem);
  stationComponent->MoltenPool.AmountUnits -= neededUnits;
  if (stationComponent->MoltenPool.AmountUnits <= 0)
    stationComponent->MoltenPool = {};
  return true;
}

bool GameWorldEngine::BendWorkpiece(uint32_t playerId, uint32_t stationId, BendZone zone, int32_t displacement)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Anvil)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *primary = stationMgr->FindSlot(stationComponent, "primary");
  if (!primary || !primary->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Insert a workpiece into the anvil primary slot first.");
    return false;
  }

  const auto *workpiece = primary->ItemRef->GetFeature<WorkpieceFeature>();
  if (!workpiece)
    return false;
  const auto &material = GetMaterialProcessingDefinition(workpiece->State.Material);
  if (!material.Bendable)
  {
    stationMgr->SetError(stationComponent, "This material cannot be bent on the anvil.");
    return false;
  }

  return Crafting::Bend(*primary->ItemRef, zone, displacement);
}

bool GameWorldEngine::ForgeWorkpiece(uint32_t playerId, uint32_t stationId, ForgeZone zone, int32_t intensity)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Anvil)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *primary = stationMgr->FindSlot(stationComponent, "primary");
  if (!primary || !primary->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Insert a heated workpiece into the anvil first.");
    return false;
  }

  const auto *workpiece = primary->ItemRef->GetFeature<WorkpieceFeature>();
  if (!workpiece)
    return false;
  const auto &material = GetMaterialProcessingDefinition(workpiece->State.Material);
  if (material.ForgeMinTemperature <= 0)
  {
    stationMgr->SetError(stationComponent, "This material does not respond to forge shaping.");
    return false;
  }

  if (!Crafting::Forge(*primary->ItemRef, zone, intensity))
  {
    stationMgr->SetError(stationComponent, "The workpiece could not be forged in its current state.");
    return false;
  }

  if (workpiece->State.TemperatureRaw < material.ForgeMinTemperature)
    stationComponent->Warnings.push_back("The workpiece is below the ideal forge window.");
  else if (workpiece->State.TemperatureRaw > material.ForgeMaxTemperature)
    stationComponent->Warnings.push_back("The workpiece is overheated and losing structure.");

  return true;
}

bool GameWorldEngine::ChipWorkpiece(uint32_t playerId, uint32_t stationId, int32_t startX, int32_t startY, int32_t width, int32_t height)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Workbench)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *primary = stationMgr->FindSlot(stationComponent, "primary");
  if (!primary || !primary->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Insert a primary workpiece into the workbench first.");
    return false;
  }

  const auto *workpiece = primary->ItemRef->GetFeature<WorkpieceFeature>();
  if (!workpiece)
    return false;
  const auto &material = GetMaterialProcessingDefinition(workpiece->State.Material);
  if (!material.Chippable)
  {
    stationMgr->SetError(stationComponent, "This material cannot be chipped or chiseled here.");
    return false;
  }

  return Crafting::Chip(*primary->ItemRef, startX, startY, width, height);
}

bool GameWorldEngine::SharpenWorkpiece(uint32_t playerId, uint32_t stationId, SharpenSide side, int32_t amount)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *inventoryMgr = Ctx.GetManager<InventoryComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !inventoryMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Grindstone)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *workpieceSlot = stationMgr->FindSlot(stationComponent, "workpiece");
  if (!workpieceSlot || !workpieceSlot->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Insert a workpiece into the grindstone first.");
    return false;
  }

  const auto *workpiece = workpieceSlot->ItemRef->GetFeature<WorkpieceFeature>();
  if (!workpiece)
    return false;
  const auto &material = GetMaterialProcessingDefinition(workpiece->State.Material);
  if (!material.Sharpenable)
  {
    stationMgr->SetError(stationComponent, "This material cannot be sharpened effectively.");
    return false;
  }

  const bool result = Crafting::Sharpen(*workpieceSlot->ItemRef, side, amount);
  if (result && workpiece->State.BreakRisk > material.LocalFractureThreshold * 5)
    stationComponent->Warnings.push_back("This edge is thin and close to fracturing.");
  return result;
}

bool GameWorldEngine::JoinWorkpieces(uint32_t playerId, uint32_t stationId)
{
  auto *player = ObjectManager.GetById(playerId);
  auto *station = ObjectManager.GetById(stationId);
  auto *interactMgr = Ctx.GetManager<InteractableComponentManager>();
  auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>();
  if (!player || !station || !interactMgr || !stationMgr)
    return false;
  if (!interactMgr->CanInteract(playerId, stationId))
    return false;

  auto *stationComponent = stationMgr->Get(stationId);
  if (!stationComponent || stationComponent->StationType != CraftingStationType::Workbench)
    return false;

  stationMgr->ClearTransientState(stationComponent);
  auto *primary = stationMgr->FindSlot(stationComponent, "primary");
  auto *secondary = stationMgr->FindSlot(stationComponent, "secondary");
  auto *handle = stationMgr->FindSlot(stationComponent, "handle");
  auto *output = stationMgr->FindSlot(stationComponent, "output");
  if (!output || output->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Collect the current workbench output first.");
    return false;
  }

  if (!primary || !primary->ItemRef)
  {
    stationMgr->SetError(stationComponent, "Insert a primary part into the workbench first.");
    return false;
  }

  std::unique_ptr<Item> result = std::move(primary->ItemRef);
  bool joinedAny = false;

  auto joinIntoResult = [&](CraftingStationSlot *slot) -> bool {
    if (!slot || !slot->ItemRef)
      return true;
    if (!Crafting::Join(*result, *slot->ItemRef))
      return false;
    slot->ItemRef.reset();
    joinedAny = true;
    return true;
  };

  if (!joinIntoResult(handle))
  {
    stationMgr->SetError(stationComponent, "The handle or shaft is not a compatible structural fit.");
    primary->ItemRef = std::move(result);
    return false;
  }
  if (!joinIntoResult(secondary))
  {
    stationMgr->SetError(stationComponent, "The secondary part does not align with the current assembly.");
    primary->ItemRef = std::move(result);
    return false;
  }

  if (!joinedAny)
  {
    stationMgr->SetError(stationComponent, "Insert at least one secondary or handle part before assembling.");
    primary->ItemRef = std::move(result);
    return false;
  }

  output->ItemRef = std::move(result);
  stationComponent->Warnings.push_back("Assembly quality now influences durability and break risk.");
  return true;
}

// ─── Tile Operations ───

void GameWorldEngine::DestroyTile(int32_t wx, int32_t wy, int32_t wz)
{
  World.ChunkManager->SetTileAt(wx, wy, wz, 0);
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

  if (auto *stationMgr = Ctx.GetManager<CraftingStationComponentManager>())
  {
    stationMgr->Tick(*this, Ctx.GetManager<InventoryComponentManager>());
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
