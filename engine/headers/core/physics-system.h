#pragma once
#include <fpm/math.hpp>
#include <fpm/fixed.hpp>
#include <memory>
#include <unordered_set>
#include "math/number.h"
#include "math/point.h"
#include "core/game-object/game-object.h"
#include "core/game-object-physics.h"
#include "core/world.h"

class InteractableComponentManager;

class PhysicsSystem
{
private:
  std::unique_ptr<GameObjectPhysics> _aabbTree;

public:
  PhysicsSystem();
  ~PhysicsSystem() = default;

  unsigned int AddObject(GameObject *obj);
  void UpdateObject(unsigned int physicsId);
  void RemoveObject(unsigned int physicsId);

  void Tick(WorldManager *chunkManager, const std::unordered_set<uint32_t> &dirtyEntityIds);

  void UpdateFocus(GameObject *source, const Point &mousePosition,
                   const InteractableComponentManager *interactMgr);

private:
  void ResolveCircleCollision(GameObject *objA, GameObject *objB);
};