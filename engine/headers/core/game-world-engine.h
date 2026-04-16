#pragma once
#include <string>
#include <vector>
#include "managable.h"
#include "core/game-object/game-object-manager.h"
#include "core/game-context.h"
#include "core/game-world.h"
#include "core/physics-system.h"
#include "core/snapshot-buffer.h"
#include "core/world-layer-system.h"
#include "core/combat/body-parts.h"
#include "core/combat/body-state-manifest.h"
#include "core/combat/combat-events.h"
#include "core/components/crafting-station-component.h"
#include "core/entity-type.h"
#include "game/managers/player-manager.h"
#include "game/managers/prop-manager.h"

struct TileDef
{
  uint16_t id;
  std::string name;
  TileGameplayDef gameplay;
};

class GameWorldEngine : public WithId
{
public:
  GameWorld World;
  PhysicsSystem Physics;
  WorldLayerSystem Layers;
  SnapshotBuffer Snapshot;
  CombatEventBuffer CombatEvents;
  GameObjectManager ObjectManager;
  ComponentsManagersRegistry Managers;
  GameContext Ctx;
  PlayerManager Players;
  PropManager Props;

  uint32_t TickCount = 0;

  GameWorldEngine();

  void RemovePlayer(const uint32_t id);
  uint32_t AddProp(double x, double y, double radius, int32_t z);
  void DestroyProp(const uint32_t id);

  void ProcessInput(const uint32_t id, const uint8_t *data, size_t length);
  void Interact(const uint32_t id);
  bool TransferItem(const uint32_t playerId, const uint32_t targetId,
                    int fromContainer, int toContainer, int itemIndex);
  bool ToggleEquipItem(uint32_t entityId, int itemIndex);
  bool DropItem(uint32_t entityId, int itemIndex);
  bool PickupItem(uint32_t playerId, uint32_t targetId);
  bool StartAttack(uint32_t entityId, AttackDirection direction);
  bool SetBlockState(uint32_t entityId, bool active, BlockDirection direction);
  bool MineTile(uint32_t playerId, int32_t tileX, int32_t tileY);
  bool InsertItemIntoStation(uint32_t playerId, uint32_t stationId, int itemIndex, const std::string &slotId = "");
  bool RemoveItemFromStation(uint32_t playerId, uint32_t stationId, const std::string &slotId = "");
  bool StartHeating(uint32_t playerId, uint32_t stationId);
  bool CollectSmeltResult(uint32_t playerId, uint32_t stationId, const std::string &slotId = "output");
  bool CastWorkpiece(uint32_t playerId, uint32_t stationId, MoldSilhouette silhouette, int32_t width, int32_t length, int32_t thicknessRaw);
  bool BendWorkpiece(uint32_t playerId, uint32_t stationId, BendZone zone, int32_t displacement);
  bool ForgeWorkpiece(uint32_t playerId, uint32_t stationId, ForgeZone zone, int32_t intensity);
  bool ChipWorkpiece(uint32_t playerId, uint32_t stationId, int32_t startX, int32_t startY, int32_t width, int32_t height);
  bool SharpenWorkpiece(uint32_t playerId, uint32_t stationId, SharpenSide side, int32_t amount);
  bool JoinWorkpieces(uint32_t playerId, uint32_t stationId);
  void SpawnTestChest();
  void DestroyTile(int32_t wx, int32_t wy, int32_t wz);

  void SetTileRegistry(const std::vector<TileDef> &registry);

  void Tick();

  void SerializeSnapshot();

  std::vector<uint8_t> SerializeBodyStateManifest();
  std::vector<uint8_t> SerializeEntityBodyState(uint32_t entityId);

  static EntityType ResolveEntityType(const std::string &typeStr);

private:
  bool DeliverTerrainReward(uint32_t playerId, int32_t tileX, int32_t tileY, const TerrainStageRewardGrant &reward, size_t rewardIndex);
  void WriteEntity(uint8_t *buf, size_t offset, const GameObject &obj);
};
