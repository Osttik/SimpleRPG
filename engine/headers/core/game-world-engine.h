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
