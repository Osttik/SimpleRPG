#pragma once

#include <cstddef>
#include <cstdint>
#include "core/combat/combat-rig-contract.generated.h"

enum class BodyPart : uint8_t
{
  Head = CombatRigContract::BodyPartHead,
  Neck = CombatRigContract::BodyPartNeck,
  Torso = CombatRigContract::BodyPartTorso,
  ChestVirtual = CombatRigContract::BodyPartChestVirtual,
  BellyVirtual = CombatRigContract::BodyPartBellyVirtual,
  PelvisVirtual = CombatRigContract::BodyPartPelvisVirtual,
  ShoulderL = CombatRigContract::BodyPartShoulderL,
  UpperArmL = CombatRigContract::BodyPartUpperArmL,
  ForearmHandL = CombatRigContract::BodyPartForearmHandL,
  ShoulderR = CombatRigContract::BodyPartShoulderR,
  UpperArmR = CombatRigContract::BodyPartUpperArmR,
  ForearmHandR = CombatRigContract::BodyPartForearmHandR,
  ThighL = CombatRigContract::BodyPartThighL,
  ShinFootL = CombatRigContract::BodyPartShinFootL,
  ThighR = CombatRigContract::BodyPartThighR,
  ShinFootR = CombatRigContract::BodyPartShinFootR,
  Shield = CombatRigContract::BodyPartShield,
  Count = CombatRigContract::BodyPartCount
};

enum class BodyLayer : uint8_t
{
  Outer = 0,
  Virtual = 1
};

enum class AttackType : uint8_t
{
  None = 0,
  Slash,
  Thrust
};

enum class AttackDirection : uint8_t
{
  None = 0,
  SlashLeftToRight,
  SlashRightToLeft,
  RisingSlash,
  OverheadSlash,
  ThrustFront
};

enum class BlockDirection : uint8_t
{
  None = 0,
  High,
  Left,
  Right,
  Front
};

enum PartFlags : uint8_t
{
  PartFlagNone = 0,
  PartFlagDisabled = 1 << 0,
  PartFlagUnusable = 1 << 1,
  PartFlagHidden = 1 << 2
};

enum FunctionalFlags : uint8_t
{
  FunctionalFlagNone = 0,
  FunctionalFlagMovementImpaired = 1 << 0,
  FunctionalFlagMovementLocked = 1 << 1,
  FunctionalFlagCannotAttack = 1 << 2,
  FunctionalFlagCannotBlock = 1 << 3
};

constexpr size_t BODY_PART_COUNT = static_cast<size_t>(BodyPart::Count);
static_assert(BODY_PART_COUNT == CombatRigContract::BodyPartCount);
