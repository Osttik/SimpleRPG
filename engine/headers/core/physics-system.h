#pragma once
#include <fpm/math.hpp>
#include <fpm/fixed.hpp>
#include <memory>
#include <unordered_set>
class GameObjectPhysics;
class GameObject;
#include "math/number.h"

class WorldManager;

class PhysicsSystem
{
private:
  std::unique_ptr<GameObjectPhysics> _aabbTree;

public:
  PhysicsSystem();

  unsigned int AddObject(GameObject *obj);
  void UpdateObject(unsigned int physicsId);
  void RemoveObject(unsigned int physicsId);

  void Tick(WorldManager *chunkManager, const std::unordered_set<uint32_t> &dirtyEntityIds);

  void UpdateFocus(GameObject *source, const Point &mousePosition);

private:
  void ResolveCircleCollision(GameObject *objA, GameObject *objB);
};