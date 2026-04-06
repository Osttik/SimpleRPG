#pragma once
#include <memory>
#include <string>
#include <unordered_set>
#include "macros.h"
#include "managable.h"
#include "math/rect.h"
#include "core/game-object/transform.h"

class GameWorldEngine;

class GameObject : public WithId
{
public:
  TransformData Transform;

  READ_ONLY_COMPONENT(std::unique_ptr<Shape>, BoundingBox);

  GameWorldEngine *Context = nullptr;

  std::string Type = "prop";
  float32 Radius = float32(0);

  uint32_t FocusedObjectId = 0;
  unsigned int PhysicsId = 0;

  bool IsStaticProp = false;
  bool IsPendingDestruction = false;

  GameObject(Point position, std::unique_ptr<Shape> rect)
      : Transform(position), _BoundingBox(std::move(rect)) {}
};