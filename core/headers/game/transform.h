#pragma once
#include "math/point.h"

class TransformData {
public:
  const Point Position;

  TransformData(Point position): Position(position) {}
};