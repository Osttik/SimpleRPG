#pragma once
#include <memory>
#include <unordered_map>
#include "managable.h"
#include "macros.h"
#include "core/game-world-engine.h"

using EngineMap = std::unordered_map<uint32_t, std::unique_ptr<GameWorldEngine>>;

class GameInstance: public WithId {
public:
  READ_ONLY_COMPONENT(EngineMap, Engines)
  
  uint32_t CreateWorld();
};