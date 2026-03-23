#pragma once
#include <fpm/math.hpp>
#include <fpm/fixed.hpp>
#include <memory>
#include "game/game-world.h"
#include "game/game-object-physics.h"
#include "math/number.h"

class PhysicsSystem
{
private:
  std::unique_ptr<GameObjectPhysics> _aabbTree;

public:
  PhysicsSystem();

  unsigned int AddObject(GameObject *obj);
  void UpdateObject(unsigned int physicsId);
  void RemoveObject(unsigned int physicsId);

  void Tick(GameWorld &world);
  void UpdateFocus(GameObject* source, const Point& mousePosition);

private:
  void ResolveCircleCollision(GameObject *objA, GameObject *objB);
};