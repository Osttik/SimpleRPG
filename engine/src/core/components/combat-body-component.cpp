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
    state.Integrity = float32(0);
    state.MaxIntegrity = float32(0);
    state.Flags = PartFlagNone;
  }

  CombatPartState &shield = component.Parts[CombatRigContract::Shield.PartId];
  shield.Integrity = float32(CombatRigContract::Shield.DefaultIntegrity);
  shield.MaxIntegrity = float32(CombatRigContract::Shield.MaxIntegrity);
  shield.StopPower = float32(CombatRigContract::Shield.StopPower);
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

  const uint8_t oldFlags = state->Flags;

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

  if (state->Flags != oldFlags)
  {
    BumpBodyStateVersion(entityId);
  }

  RecomputeFunctionalFlags(entityId);
  return true;
}

bool CombatBodyComponentManager::ApplyShieldIntegrityDamage(uint32_t entityId, float32 damage, float32 &remainingIntegrity, bool &brokenNow)
{
  remainingIntegrity = float32(0);
  brokenNow = false;

  auto *state = GetPartState(entityId, BodyPart::Shield);
  if (!state || damage <= float32(0))
    return false;

  const bool wasBroken = state->Integrity <= float32(CombatRigContract::Shield.BreakThreshold) ||
                         (state->Flags & PartFlagDisabled) != 0;

  if (state->Integrity > damage)
  {
    state->Integrity -= damage;
  }
  else
  {
    state->Integrity = float32(0);
  }
  remainingIntegrity = state->Integrity;

  const bool isBroken = state->Integrity <= float32(CombatRigContract::Shield.BreakThreshold);
  if (isBroken)
  {
    state->Flags = static_cast<uint8_t>(state->Flags | PartFlagDisabled | PartFlagUnusable | PartFlagHidden);
    state->Hp = float32(0);
  }

  brokenNow = !wasBroken && isBroken;
  if (brokenNow)
  {
    BumpBodyStateVersion(entityId);
  }

  RecomputeFunctionalFlags(entityId);
  return true;
}

bool CombatBodyComponentManager::IsShieldBroken(uint32_t entityId) const
{
  const auto *state = GetPartState(entityId, BodyPart::Shield);
  if (!state)
    return true;
  return state->Integrity <= float32(CombatRigContract::Shield.BreakThreshold) ||
         (state->Flags & PartFlagDisabled) != 0;
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
    if (part == BodyPart::Shield && state.Integrity <= float32(CombatRigContract::Shield.BreakThreshold))
      return true;
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

void CombatBodyComponentManager::BumpBodyStateVersion(uint32_t entityId)
{
  auto *component = Get(entityId);
  if (!component)
    return;
  component->BodyStateVersion++;
}

uint16_t CombatBodyComponentManager::GetBodyStateVersion(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return 0;
  return component->BodyStateVersion;
}

uint32_t CombatBodyComponentManager::GetDisabledPartsMask(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return 0;

  uint32_t mask = 0;
  for (size_t i = 0; i < BODY_PART_COUNT; ++i)
  {
    if (component->Parts[i].Flags & PartFlagDisabled)
      mask |= (1u << i);
  }
  return mask;
}

uint32_t CombatBodyComponentManager::GetHiddenPartsMask(uint32_t entityId) const
{
  const auto *component = Get(entityId);
  if (!component)
    return 0;

  uint32_t mask = 0;
  for (size_t i = 0; i < BODY_PART_COUNT; ++i)
  {
    if (component->Parts[i].Flags & PartFlagHidden)
      mask |= (1u << i);
  }
  return mask;
}
