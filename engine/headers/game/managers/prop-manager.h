#pragma once
#include "math/point.h"
#include "math/number.h"
#include "core/inventory.h"

class GameWorldEngine;

class PropManager
{
public:
  uint32_t AddChest(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  uint32_t AddSmelter(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  uint32_t AddAnvil(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  uint32_t AddWorkbench(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  uint32_t AddGrindstone(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z);
  uint32_t AddDroppedItem(GameWorldEngine &engine, const Point &position, std::unique_ptr<Item> item);
  void DestroyProp(GameWorldEngine &engine, uint32_t propId);
};
