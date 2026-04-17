#pragma once

#include <cstdlib>
#include <iostream>
#include <string>

inline bool EngineLoggingEnabled()
{
  const char *value = std::getenv("SIMPLERPG_ENGINE_LOG");
  return value != nullptr && value[0] == '1';
}

inline void EngineLog(const char *scope, const std::string &message)
{
  if (!EngineLoggingEnabled())
    return;

  std::clog << "[engine][" << scope << "] " << message << std::endl;
}