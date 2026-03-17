#pragma once
#include <memory>
#include "game/transform.h"
#include "math/rect.h"

class GameObject {
public:
  const TransformData Transform;
  const std::unique_ptr<Shape> BoundingBox;

  GameObject(TransformData transform, std::unique_ptr<Shape> rect): Transform(transform), BoundingBox(std::move(rect)) {}
};