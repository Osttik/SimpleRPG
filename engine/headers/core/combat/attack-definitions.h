#pragma once

#include <array>
#include <cstdint>
#include "core/combat/body-parts.h"
#include "math/number.h"

constexpr size_t MAX_ATTACK_TICKS = 40;

struct CombatLocalPoint
{
  float32 X = float32(0);
  float32 Y = float32(0);
};

struct AttackStepSample
{
  CombatLocalPoint Hilt;
  CombatLocalPoint Tip;
  float32 Energy = float32(0);
  float32 DamageMultiplier = float32(1);
};

struct ShieldInteractionProfile
{
  float32 ShieldDamageMultiplier = float32(1);
  float32 ShieldPenetrationMultiplier = float32(0);
  float32 ShieldStopPowerBonus = float32(0);
  float32 BluntThroughBlockRatio = float32(0);
};

struct AttackDefinition
{
  AttackType Type = AttackType::None;
  AttackDirection Direction = AttackDirection::None;
  uint8_t TotalTicks = 0;
  uint64_t ActiveMask = 0;
  float32 BaseDamage = float32(0);
  ShieldInteractionProfile ShieldProfile{};
  std::array<AttackStepSample, MAX_ATTACK_TICKS> Steps{};

  bool IsActive(uint8_t step) const
  {
    if (step >= TotalTicks || step >= 64)
      return false;
    return ((ActiveMask >> step) & uint64_t(1)) != 0;
  }
};

const AttackDefinition &GetAttackDefinition(AttackDirection direction);
