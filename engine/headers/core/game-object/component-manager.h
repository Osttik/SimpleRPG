#pragma once
#include <memory>
#include <vector>
#include "core/game-object/component.h"

class ComponentManager
{
public:
  std::vector<uint8_t> MembersIds;
  
  virtual ~ComponentManager() = default;

  virtual void AddComponentTo(GameObject* obj);
};