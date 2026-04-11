#include "core/components/combat-state-component.h"
#include "core/components/combat-body-component.h"

CombatStateComponent *CombatStateComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *component = Get(entityId);
  if (component)
    return component;
  return TypedComponentManager<CombatStateComponent>::Add(entityId, owner);
}

bool CombatStateComponentManager::SetBlockState(uint32_t entityId, bool active, BlockDirection direction, const CombatBodyComponentManager *bodyMgr)
{
  auto *component = Get(entityId);
  if (!component)
    return false;

  if (!active)
  {
    component->Blocking = false;
    component->ActiveBlock = BlockDirection::None;
    return true;
  }

  if (!bodyMgr || !bodyMgr->CanBlock(entityId) || direction == BlockDirection::None)
  {
    component->Blocking = false;
    component->ActiveBlock = BlockDirection::None;
    return false;
  }

  component->Blocking = true;
  component->ActiveBlock = direction;
  return true;
}

void CombatStateComponentManager::RefreshAvailability(uint32_t entityId, const CombatBodyComponentManager *bodyMgr)
{
  auto *component = Get(entityId);
  if (!component || !bodyMgr)
    return;

  if (!bodyMgr->CanBlock(entityId))
  {
    component->Blocking = false;
    component->ActiveBlock = BlockDirection::None;
  }
}

