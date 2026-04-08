#pragma once
#include "math/point.h"

class GameWorldEngine;

class PlayerManager
{
public:
  uint32_t AddPlayer(GameWorldEngine &engine, const Point &position);
  void RemovePlayer(GameWorldEngine &engine, uint32_t playerId);
};
