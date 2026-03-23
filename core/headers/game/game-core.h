#pragma once
#include <string>
#include <vector>
#include "game/game-world.h"
#include "game/physics-system.h"

struct TileDef
{
  uint16_t id;
  std::string name;
  bool collide;
};

class GameCore
{
public:
  GameWorld World;
  PhysicsSystem Physics;

  GameCore() = default;

  void AddPlayer(const std::string &id, double x, double y, double radius);
  void RemovePlayer(const std::string &id);
  void AddProp(const std::string &id, double x, double y, double radius, int32_t z);
  void DestroyProp(const std::string &id);

  void ApplyMovement(const std::string &id, double dx, double dy, double speed);
  std::string Interact(const std::string &id);
  bool TransferItem(const std::string &playerId, const std::string &targetId, int fromContainer, int toContainer, int itemIndex);
  void SpawnTestChest();
  void DestroyTile(int32_t wx, int32_t wy, int32_t wz);

  void SetTileRegistry(const std::vector<TileDef> &registry);

  void Tick();
  void CleanupDestroyedObjects();
};