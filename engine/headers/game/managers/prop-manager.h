#pragma once
#include "math/point.h"
#include "math/number.h"

class GameWorldEngine;

class PropManager
{
public:
  uint32_t AddChest(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  void DestroyProp(GameWorldEngine &engine, uint32_t propId);
};
