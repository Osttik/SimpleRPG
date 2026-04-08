#pragma once
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "math/number.h"

const float32 SPEED(5);

struct MoveComponent : public Component
{
  float32 Speed = SPEED;

  MoveComponent(GameObject *owner) : Component(owner) {}
};

class MoveComponentManager : public TypedComponentManager<MoveComponent>
{
public:
  void Move(uint32_t entityId, float32 dx, float32 dy);
};
