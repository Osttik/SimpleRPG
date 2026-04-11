#pragma once

#include <array>
#include "core/combat/body-parts.h"
#include "core/game-object/component-manager.h"
#include "math/number.h"

struct CombatPartState
{
  float32 Hp = float32(0);
  float32 MaxHp = float32(0);
  float32 StopPower = float32(0);
  uint8_t Flags = PartFlagNone;
};

struct CombatBodyComponent : public Component
{
  std::array<CombatPartState, BODY_PART_COUNT> Parts{};
  uint8_t FunctionalStateFlags = FunctionalFlagNone;
  float32 MovementSpeedMultiplier = float32(1);

  CombatBodyComponent(GameObject *owner) : Component(owner) {}
};

class CombatBodyComponentManager : public TypedComponentManager<CombatBodyComponent>
{
public:
  CombatBodyComponent *AddDefaultHumanoid(uint32_t entityId, GameObject *owner);
  void ResetToDefault(CombatBodyComponent &component) const;
  float32 GetMovementSpeedMultiplier(uint32_t entityId) const;
  bool CanAttack(uint32_t entityId) const;
  bool CanBlock(uint32_t entityId) const;

  CombatPartState *GetPartState(uint32_t entityId, BodyPart part);
  const CombatPartState *GetPartState(uint32_t entityId, BodyPart part) const;

  bool ApplyDamage(uint32_t entityId, BodyPart part, float32 damage);
  void RecomputeFunctionalFlags(uint32_t entityId);
};

