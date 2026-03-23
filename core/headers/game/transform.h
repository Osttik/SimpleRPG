#pragma once
#include "math/point.h"

class TransformData {
public:
  mutable Point Position;
  mutable Point FacingDirection{float32(0), float32(1)}; // Default facing Down

  TransformData(Point position): Position(position) {}
};