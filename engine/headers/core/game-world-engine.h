#pragma once
#include <string>
#include <vector>
#include "managable.h"
#include "core/game-object/game-object-manager.h"
#include "core/game-context.h"
#include "core/game-world.h"
#include "core/physics-system.h"
#include "core/snapshot-buffer.h"
#include "core/combat/body-parts.h"
#include "core/combat/combat-events.h"
#include "core/entity-type.h"
#include "game/managers/player-manager.h"
#include "game/managers/prop-manager.h"

struct TileDef
{
  uint16_t id;
  std::string name;
  bool collide;
};

class GameWorldEngine : public WithId
{
public:
  GameWorld World;
  PhysicsSystem Physics;
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
  void SpawnTestChest();
  void DestroyTile(int32_t wx, int32_t wy, int32_t wz);

  void SetTileRegistry(const std::vector<TileDef> &registry);

  void Tick();

  void SerializeSnapshot();

  static EntityType ResolveEntityType(const std::string &typeStr);

private:
  void WriteEntity(uint8_t *buf, size_t offset, const GameObject &obj);
};
