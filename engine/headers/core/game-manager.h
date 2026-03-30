#pragma once
#include <memory>
#include <unordered_map>
#include "core/game-instance.h"
#include "net/user-connection.h"

class GameManager
{
private:
  static std::unordered_map<uint32_t, std::unique_ptr<GameInstance>> _instances;
  static std::unordered_map<uint32_t, std::unique_ptr<UserConnection>> _connections;

public:
  static uint32_t CreateInstance();
  static uint32_t ConnectPlayer();
};