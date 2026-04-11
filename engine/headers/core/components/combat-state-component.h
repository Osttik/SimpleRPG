#pragma once

#include "core/combat/body-parts.h"
#include "core/game-object/component-manager.h"

class CombatBodyComponentManager;

struct CombatStateComponent : public Component
{
  BlockDirection ActiveBlock = BlockDirection::None;
  bool Blocking = false;
  uint16_t AttackEpoch = 0;

  CombatStateComponent(GameObject *owner) : Component(owner) {}
};

class CombatStateComponentManager : public TypedComponentManager<CombatStateComponent>
{
public:
  CombatStateComponent *Ensure(uint32_t entityId, GameObject *owner);
  bool SetBlockState(uint32_t entityId, bool active, BlockDirection direction, const CombatBodyComponentManager *bodyMgr);
  void RefreshAvailability(uint32_t entityId, const CombatBodyComponentManager *bodyMgr);
};

