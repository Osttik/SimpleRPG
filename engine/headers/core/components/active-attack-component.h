#pragma once

#include <array>
#include "core/combat/attack-definitions.h"
#include "core/game-object/component-manager.h"

class GameWorldEngine;
class CombatBodyComponentManager;
class CombatStateComponentManager;

constexpr size_t MAX_ATTACK_HIT_MARKERS = 32;

struct AttackHitMarker
{
  uint32_t TargetId = 0;
  uint8_t PartId = 0;
};

struct ActiveAttackComponent : public Component
{
  bool Active = false;
  AttackType Type = AttackType::None;
  AttackDirection Direction = AttackDirection::None;
  uint8_t TotalTicks = 0;
  uint8_t TickIndex = 0;
  uint8_t RemainingTicks = 0;
  uint16_t Epoch = 0;
  std::array<AttackHitMarker, MAX_ATTACK_HIT_MARKERS> AlreadyHit{};
  uint8_t AlreadyHitCount = 0;

  ActiveAttackComponent(GameObject *owner) : Component(owner) {}
};

class ActiveAttackComponentManager : public TypedComponentManager<ActiveAttackComponent>
{
public:
  ActiveAttackComponent *Ensure(uint32_t entityId, GameObject *owner);
  bool StartAttack(uint32_t entityId, AttackDirection direction,
                   CombatBodyComponentManager *bodyMgr,
                   CombatStateComponentManager *stateMgr,
                   GameWorldEngine &engine);
  void StopAttack(uint32_t entityId, uint8_t flags, GameWorldEngine &engine);
  void Tick(GameWorldEngine &engine,
            CombatBodyComponentManager *bodyMgr,
            CombatStateComponentManager *stateMgr);
};

