#include "core/game-instance.h"

uint32_t GameInstance::CreateWorld()
{
  auto instance = std::make_unique<GameWorldEngine>(); // constructor self-registers managers
  auto id = instance->Id;
  _Engines[id] = std::move(instance);
  return id;
}
