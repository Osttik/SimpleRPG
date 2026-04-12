#include "core/components/combat-body-component.h"

namespace
{
  template <typename PartsArray, typename Predicate>
  bool isAnyDisabled(const PartsArray &parts, Predicate &&isDisabled)
  {
    for (uint8_t partId : parts)
    {
      if (isDisabled(static_cast<BodyPart>(partId)))
        return true;
    }
    return false;
  }
}

CombatBodyComponent *CombatBodyComponentManager::AddDefaultHumanoid(uint32_t entityId, GameObject *owner)
{
  auto *component = TypedComponentManager<CombatBodyComponent>::Add(entityId, owner);
  ResetToDefault(*component);
  return component;
}

void CombatBodyComponentManager::ResetToDefault(CombatBodyComponent &component) const
{
  for (const auto &definition : CombatRigContract::BodyParts)
  {
    CombatPartState &state = component.Parts[definition.Id];
    state.Hp = float32(definition.MaxHp);
    state.MaxHp = float32(definition.MaxHp);
    state.StopPower = float32(definition.StopPower);
    state.Flags = PartFlagNone;
  }
  component.FunctionalStateFlags = FunctionalFlagNone;
  component.MovementSpeedMultiplier = float32(1);
}

float32 CombatBodyComponentManager::GetMovementSpeedMultiplier(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return float32(1);
  return component->MovementSpeedMultiplier;
}

bool CombatBodyComponentManager::CanAttack(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return false;
  return (component->FunctionalStateFlags & FunctionalFlagCannotAttack) == 0;
}

bool CombatBodyComponentManager::CanBlock(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return false;
  return (component->FunctionalStateFlags & FunctionalFlagCannotBlock) == 0;
}

CombatPartState *CombatBodyComponentManager::GetPartState(uint32_t entityId, BodyPart part)
{
  auto *component = Get(entityId);
  if (!component)
    return nullptr;
  return &component->Parts[static_cast<size_t>(part)];
}

const CombatPartState *CombatBodyComponentManager::GetPartState(uint32_t entityId, BodyPart part) const
{
  const auto *component = Get(entityId);
  if (!component)
    return nullptr;
  return &component->Parts[static_cast<size_t>(part)];
}

bool CombatBodyComponentManager::ApplyDamage(uint32_t entityId, BodyPart part, float32 damage)
{
  auto *state = GetPartState(entityId, part);
  if (!state || damage <= float32(0))
    return false;

  if (state->Hp > damage)
  {
    state->Hp -= damage;
  }
  else
  {
    state->Hp = float32(0);
  }

  if (state->Hp <= float32(0))
  {
    state->Flags = static_cast<uint8_t>(state->Flags | PartFlagDisabled | PartFlagUnusable);
  }

  RecomputeFunctionalFlags(entityId);
  return true;
}

void CombatBodyComponentManager::RecomputeFunctionalFlags(uint32_t entityId)
{
  auto *component = Get(entityId);
  if (!component)
    return;

  uint8_t flags = FunctionalFlagNone;

  const auto isDisabled = [&](BodyPart part) -> bool
  {
    const auto &state = component->Parts[static_cast<size_t>(part)];
    return state.Hp <= float32(0) || (state.Flags & PartFlagDisabled) != 0;
  };

  const bool leftLegDisabled = isAnyDisabled(CombatRigContract::LeftLegParts, isDisabled);
  const bool rightLegDisabled = isAnyDisabled(CombatRigContract::RightLegParts, isDisabled);
  if (leftLegDisabled || rightLegDisabled)
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagMovementImpaired);
  }
  if (leftLegDisabled && rightLegDisabled)
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagMovementLocked);
  }

  if (isAnyDisabled(CombatRigContract::AttackRequiredParts, isDisabled))
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagCannotAttack);
  }

  if (isAnyDisabled(CombatRigContract::BlockRequiredParts, isDisabled))
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagCannotBlock);
  }

  component->FunctionalStateFlags = flags;

  if ((flags & FunctionalFlagMovementLocked) != 0)
  {
    component->MovementSpeedMultiplier = float32(0);
  }
  else if ((flags & FunctionalFlagMovementImpaired) != 0)
  {
    component->MovementSpeedMultiplier = float32(55) / float32(100);
  }
  else
  {
    component->MovementSpeedMultiplier = float32(1);
  }
}
