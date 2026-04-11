#include "core/components/combat-body-component.h"

namespace
{
  void SetPart(CombatBodyComponent &component, BodyPart part, int maxHp, int stopPower)
  {
    CombatPartState &state = component.Parts[static_cast<size_t>(part)];
    state.Hp = float32(maxHp);
    state.MaxHp = float32(maxHp);
    state.StopPower = float32(stopPower);
    state.Flags = PartFlagNone;
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
  SetPart(component, BodyPart::Head, 32, 14);
  SetPart(component, BodyPart::Neck, 18, 10);
  SetPart(component, BodyPart::Torso, 60, 12);
  SetPart(component, BodyPart::ChestVirtual, 54, 14);
  SetPart(component, BodyPart::BellyVirtual, 50, 11);
  SetPart(component, BodyPart::PelvisVirtual, 56, 15);
  SetPart(component, BodyPart::ShoulderL, 26, 8);
  SetPart(component, BodyPart::UpperArmL, 28, 9);
  SetPart(component, BodyPart::ForearmHandL, 24, 8);
  SetPart(component, BodyPart::ShoulderR, 26, 8);
  SetPart(component, BodyPart::UpperArmR, 28, 9);
  SetPart(component, BodyPart::ForearmHandR, 24, 8);
  SetPart(component, BodyPart::ThighL, 34, 11);
  SetPart(component, BodyPart::ShinFootL, 30, 9);
  SetPart(component, BodyPart::ThighR, 34, 11);
  SetPart(component, BodyPart::ShinFootR, 30, 9);
  SetPart(component, BodyPart::Shield, 48, 26);
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

  const bool leftLegDisabled = isDisabled(BodyPart::ThighL) || isDisabled(BodyPart::ShinFootL);
  const bool rightLegDisabled = isDisabled(BodyPart::ThighR) || isDisabled(BodyPart::ShinFootR);
  if (leftLegDisabled || rightLegDisabled)
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagMovementImpaired);
  }
  if (leftLegDisabled && rightLegDisabled)
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagMovementLocked);
  }

  if (isDisabled(BodyPart::ShoulderR) || isDisabled(BodyPart::UpperArmR) || isDisabled(BodyPart::ForearmHandR))
  {
    flags = static_cast<uint8_t>(flags | FunctionalFlagCannotAttack);
  }

  if (isDisabled(BodyPart::ShoulderL) || isDisabled(BodyPart::UpperArmL) ||
      isDisabled(BodyPart::ForearmHandL) || isDisabled(BodyPart::Shield))
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

