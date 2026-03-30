#include "core/game-manager.h"

uint32_t GameManager::CreateInstance()
{
  auto instance = std::make_unique<GameInstance>();

  auto id = instance->Id;

  _instances[id] = std::move(instance);

  return id;
}

uint32_t GameManager::ConnectPlayer() {
  auto instance = std::make_unique<UserConnection>();

  auto id = instance->Id;

  _connections[id] = std::move(instance);

  return id;
}