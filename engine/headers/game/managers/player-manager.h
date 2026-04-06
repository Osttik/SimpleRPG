#pragma once
#include "math/point.h"
#include "math/number.h"
#include "core/game-world-engine.h"

class PlayerManager
{
public:
  uint32_t AddPlayer(GameWorldEngine &manager, const Point &position);
  void RemovePlayer(uint32_t playerId);
};