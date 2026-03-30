#pragma once
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "math/number.h"

const float32 SPEED(5);

class MoveComponentManager : public ComponentManager
{
public:
  void AddComponentTo(GameObject *obj) override;
};

class MoveComponent : public Component
{
public:
  MoveComponent(GameObject* owner) : Component(owner) {}
  void Move(float32 dx, float32 dy);
};