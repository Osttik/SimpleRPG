#pragma once
#include "math/point.h"

class TransformData {
public:
  mutable Point Position;

  TransformData(Point position): Position(position) {}
};