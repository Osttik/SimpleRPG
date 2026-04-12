#include <algorithm>
#include <array>
#include "core/components/active-attack-component.h"
#include "core/components/combat-body-component.h"
#include "core/components/combat-state-component.h"
#include "core/combat/combat-events.h"
#include "core/game-object/game-object.h"
#include "core/game-world-engine.h"
#include "math/point.h"
#include <fpm/math.hpp>

namespace
{
  constexpr size_t MAX_STEP_HIT_CANDIDATES = 96;
  constexpr float32 BLADE_HALF_WIDTH = float32(2);
  constexpr float32 BODY_AABB_HALF_WIDTH = float32(34);
  constexpr float32 BODY_AABB_HALF_HEIGHT = float32(38);
  constexpr float32 THRUST_SHIELD_STOP_BONUS = float32(40);
  constexpr float32 SHIELD_STOP_BONUS = float32(18);

  struct Basis2
  {
    float32 ForwardX = float32(0);
    float32 ForwardY = float32(1);
    float32 RightX = float32(1);
    float32 RightY = float32(0);
  };

  struct CombatPoint
  {
    float32 X = float32(0);
    float32 Y = float32(0);
  };

  struct CombatAabb
  {
    float32 MinX = float32(0);
    float32 MinY = float32(0);
    float32 MaxX = float32(0);
    float32 MaxY = float32(0);
  };

  struct PendingHitCandidate
  {
    uint32_t VictimId = 0;
    BodyPart Part = BodyPart::Torso;
    BodyPart RoutedPart = BodyPart::Torso;
    float32 ProgressKey = float32(0);
    float32 BladeDistanceKey = float32(0);
    float32 Damage = float32(0);
    float32 StopCost = float32(0);
    float32 RemainingHp = float32(0);
    uint8_t Flags = CombatEventFlagNone;
    bool IsShield = false;
  };

  constexpr const auto &kOuterHurtboxes = CombatRigContract::OuterHurtboxes;

  float32 AbsFixed(float32 value)
  {
    return value < float32(0) ? float32(0) - value : value;
  }

  CombatPoint ToCombatPoint(const CombatLocalPoint &value)
  {
    return CombatPoint{value.X, value.Y};
  }

  CombatPoint AddPoint(const CombatPoint &a, const CombatPoint &b)
  {
    return CombatPoint{a.X + b.X, a.Y + b.Y};
  }

  CombatPoint SubPoint(const CombatPoint &a, const CombatPoint &b)
  {
    return CombatPoint{a.X - b.X, a.Y - b.Y};
  }

  CombatPoint ScalePoint(const CombatPoint &a, float32 scale)
  {
    return CombatPoint{a.X * scale, a.Y * scale};
  }

  float32 Dot(const CombatPoint &a, const CombatPoint &b)
  {
    return (a.X * b.X) + (a.Y * b.Y);
  }

  float32 LengthSquared(const CombatPoint &a)
  {
    return Dot(a, a);
  }

  float32 ClampFixed(float32 value, float32 minValue, float32 maxValue)
  {
    if (value < minValue)
      return minValue;
    if (value > maxValue)
      return maxValue;
    return value;
  }

  Basis2 GetBasis(const GameObject *object)
  {
    Basis2 basis;
    if (!object)
      return basis;

    CombatPoint facing{object->Transform.FacingDirection().X, object->Transform.FacingDirection().Y};
    float32 lenSq = LengthSquared(facing);
    if (lenSq <= float32(0))
      return basis;

    float32 len = fpm::sqrt(lenSq);
    if (len <= float32(0))
      return basis;

    basis.ForwardX = facing.X / len;
    basis.ForwardY = facing.Y / len;
    basis.RightX = basis.ForwardY;
    basis.RightY = float32(0) - basis.ForwardX;
    return basis;
  }

  CombatPoint LocalToWorld(const GameObject *object, const Basis2 &basis, const CombatPoint &local)
  {
    const Point &origin = object->Transform.Position();
    return CombatPoint{
        origin.X + (basis.RightX * local.X) + (basis.ForwardX * local.Y),
        origin.Y + (basis.RightY * local.X) + (basis.ForwardY * local.Y)};
  }

  CombatPoint WorldToLocal(const GameObject *object, const Basis2 &basis, const CombatPoint &world)
  {
    const Point &origin = object->Transform.Position();
    CombatPoint delta{world.X - origin.X, world.Y - origin.Y};
    return CombatPoint{
        Dot(delta, CombatPoint{basis.RightX, basis.RightY}),
        Dot(delta, CombatPoint{basis.ForwardX, basis.ForwardY})};
  }

  CombatAabb MakeAabb(float32 minX, float32 minY, float32 maxX, float32 maxY)
  {
    return CombatAabb{minX, minY, maxX, maxY};
  }

  CombatAabb BuildSweepAabb(const CombatPoint &a, const CombatPoint &b, const CombatPoint &c, const CombatPoint &d)
  {
    const float32 minX = (std::min)((std::min)(a.X, b.X), (std::min)(c.X, d.X)) - BLADE_HALF_WIDTH;
    const float32 minY = (std::min)((std::min)(a.Y, b.Y), (std::min)(c.Y, d.Y)) - BLADE_HALF_WIDTH;
    const float32 maxX = (std::max)((std::max)(a.X, b.X), (std::max)(c.X, d.X)) + BLADE_HALF_WIDTH;
    const float32 maxY = (std::max)((std::max)(a.Y, b.Y), (std::max)(c.Y, d.Y)) + BLADE_HALF_WIDTH;
    return MakeAabb(minX, minY, maxX, maxY);
  }

  CombatAabb BuildBodyAabb(const GameObject *object)
  {
    const Point &pos = object->Transform.Position();
    return MakeAabb(
        pos.X - BODY_AABB_HALF_WIDTH,
        pos.Y - BODY_AABB_HALF_HEIGHT,
        pos.X + BODY_AABB_HALF_WIDTH,
        pos.Y + BODY_AABB_HALF_HEIGHT);
  }

  bool AabbOverlaps(const CombatAabb &a, const CombatAabb &b)
  {
    return !(a.MaxX < b.MinX || a.MinX > b.MaxX || a.MaxY < b.MinY || a.MinY > b.MaxY);
  }

  CombatPoint GetHurtboxCenter(const CombatRigContract::HurtboxDefinition &hurtbox)
  {
    if (hurtbox.Primitive == CombatRigContract::HurtboxPrimitive::Circle)
      return CombatPoint{float32(hurtbox.A), float32(hurtbox.B)};
    return CombatPoint{float32(hurtbox.A + hurtbox.C) / float32(2), float32(hurtbox.B + hurtbox.D) / float32(2)};
  }

  bool ClipSegment(float32 p, float32 q, float32 &t0, float32 &t1)
  {
    if (p == float32(0))
      return q >= float32(0);

    float32 r = q / p;
    if (p < float32(0))
    {
      if (r > t1)
        return false;
      if (r > t0)
        t0 = r;
      return true;
    }

    if (r < t0)
      return false;
    if (r < t1)
      t1 = r;
    return true;
  }

  bool SegmentIntersectsExpandedBox(const CombatPoint &start, const CombatPoint &end,
                                    float32 minX, float32 minY, float32 maxX, float32 maxY,
                                    float32 expansion)
  {
    minX -= expansion;
    minY -= expansion;
    maxX += expansion;
    maxY += expansion;

    float32 t0 = float32(0);
    float32 t1 = float32(1);
    const float32 dx = end.X - start.X;
    const float32 dy = end.Y - start.Y;

    return ClipSegment(float32(0) - dx, start.X - minX, t0, t1) &&
           ClipSegment(dx, maxX - start.X, t0, t1) &&
           ClipSegment(float32(0) - dy, start.Y - minY, t0, t1) &&
           ClipSegment(dy, maxY - start.Y, t0, t1);
  }

  float32 SegmentDistanceSquared(const CombatPoint &start, const CombatPoint &end, const CombatPoint &point)
  {
    CombatPoint delta = SubPoint(end, start);
    float32 lenSq = LengthSquared(delta);
    if (lenSq <= float32(0))
      return LengthSquared(SubPoint(point, start));

    float32 t = Dot(SubPoint(point, start), delta) / lenSq;
    t = ClampFixed(t, float32(0), float32(1));
    CombatPoint closest = AddPoint(start, ScalePoint(delta, t));
    return LengthSquared(SubPoint(point, closest));
  }

  bool SegmentIntersectsExpandedCircle(const CombatPoint &start, const CombatPoint &end,
                                       const CombatPoint &center, float32 radius, float32 expansion)
  {
    const float32 threshold = radius + expansion;
    return SegmentDistanceSquared(start, end, center) <= (threshold * threshold);
  }

  bool HurtboxIntersectsSweep(const CombatRigContract::HurtboxDefinition &hurtbox,
                              const CombatPoint &prevHilt, const CombatPoint &prevTip,
                              const CombatPoint &currHilt, const CombatPoint &currTip)
  {
    if (hurtbox.Primitive == CombatRigContract::HurtboxPrimitive::Circle)
    {
      CombatPoint center{float32(hurtbox.A), float32(hurtbox.B)};
      const float32 radius = float32(hurtbox.C);
      return SegmentIntersectsExpandedCircle(prevHilt, prevTip, center, radius, BLADE_HALF_WIDTH) ||
             SegmentIntersectsExpandedCircle(currHilt, currTip, center, radius, BLADE_HALF_WIDTH) ||
             SegmentIntersectsExpandedCircle(prevTip, currTip, center, radius, BLADE_HALF_WIDTH) ||
             SegmentIntersectsExpandedCircle(prevHilt, currHilt, center, radius, BLADE_HALF_WIDTH);
    }

    const float32 a = float32(hurtbox.A);
    const float32 b = float32(hurtbox.B);
    const float32 c = float32(hurtbox.C);
    const float32 d = float32(hurtbox.D);
    return SegmentIntersectsExpandedBox(prevHilt, prevTip, a, b, c, d, BLADE_HALF_WIDTH) ||
           SegmentIntersectsExpandedBox(currHilt, currTip, a, b, c, d, BLADE_HALF_WIDTH) ||
           SegmentIntersectsExpandedBox(prevTip, currTip, a, b, c, d, BLADE_HALF_WIDTH) ||
           SegmentIntersectsExpandedBox(prevHilt, currHilt, a, b, c, d, BLADE_HALF_WIDTH);
  }

  BodyPart RouteTorsoVirtual(const CombatPoint &localImpact)
  {
    if (localImpact.Y > float32(CombatRigContract::ChestMinYExclusive))
      return static_cast<BodyPart>(CombatRigContract::ChestVirtualPart);
    if (localImpact.Y < float32(CombatRigContract::PelvisMaxYExclusive))
      return static_cast<BodyPart>(CombatRigContract::PelvisVirtualPart);
    return static_cast<BodyPart>(CombatRigContract::BellyVirtualPart);
  }

  uint8_t ComputeIncomingFlags(const GameObject *attacker, const GameObject *defender, const Basis2 &defenderBasis)
  {
    CombatPoint attackerPos{attacker->Transform.Position().X, attacker->Transform.Position().Y};
    CombatPoint localAttacker = WorldToLocal(defender, defenderBasis, attackerPos);
    return localAttacker.Y < float32(0) ? CombatEventFlagBackHit : CombatEventFlagNone;
  }

  BlockDirection ResolveIncomingBlockDirection(const GameObject *attacker, const GameObject *defender,
                                               const Basis2 &defenderBasis, AttackDirection attackDirection)
  {
    CombatPoint attackerPos{attacker->Transform.Position().X, attacker->Transform.Position().Y};
    CombatPoint localAttacker = WorldToLocal(defender, defenderBasis, attackerPos);
    if (localAttacker.Y <= float32(0))
      return BlockDirection::None;

    if (attackDirection == AttackDirection::OverheadSlash || attackDirection == AttackDirection::RisingSlash)
      return BlockDirection::High;
    if (attackDirection == AttackDirection::ThrustFront)
      return BlockDirection::Front;
    return localAttacker.X < float32(0) ? BlockDirection::Left : BlockDirection::Right;
  }

  bool CanStandardBlockDirection(BlockDirection activeBlock, BlockDirection incomingDirection)
  {
    if (incomingDirection == BlockDirection::None)
      return false;
    if (activeBlock == BlockDirection::Front)
      return true;
    return activeBlock == incomingDirection;
  }

  bool AlreadyHitPart(const ActiveAttackComponent &attack, uint32_t targetId, BodyPart part)
  {
    const uint8_t partId = static_cast<uint8_t>(part);
    for (uint8_t i = 0; i < attack.AlreadyHitCount; ++i)
    {
      if (attack.AlreadyHit[i].TargetId == targetId && attack.AlreadyHit[i].PartId == partId)
        return true;
    }
    return false;
  }

  void RecordHit(ActiveAttackComponent &attack, uint32_t targetId, BodyPart part)
  {
    if (attack.AlreadyHitCount >= MAX_ATTACK_HIT_MARKERS)
      return;
    attack.AlreadyHit[attack.AlreadyHitCount++] = AttackHitMarker{targetId, static_cast<uint8_t>(part)};
  }

  float32 ComputeDamage(const AttackDefinition &definition, const AttackStepSample &step,
                        float32 bladeT, uint8_t eventFlags, float32 currentEnergy)
  {
    float32 tipBias = float32(70) / float32(100) + (bladeT * (float32(60) / float32(100)));
    float32 sideBias = (eventFlags & CombatEventFlagBackHit) != 0 ? float32(120) / float32(100) : float32(1);
    float32 energyBias = ClampFixed(currentEnergy / float32(24), float32(60) / float32(100), float32(140) / float32(100));
    return definition.BaseDamage * step.DamageMultiplier * tipBias * sideBias * energyBias;
  }

  bool CandidateLess(const PendingHitCandidate &a, const PendingHitCandidate &b)
  {
    if (a.VictimId == b.VictimId && a.IsShield != b.IsShield)
      return a.IsShield;
    if (a.ProgressKey != b.ProgressKey)
      return a.ProgressKey < b.ProgressKey;
    if (a.BladeDistanceKey != b.BladeDistanceKey)
      return a.BladeDistanceKey < b.BladeDistanceKey;
    if (a.Part != b.Part)
      return static_cast<uint8_t>(a.Part) < static_cast<uint8_t>(b.Part);
    return a.VictimId < b.VictimId;
  }

  uint8_t GetVisualTrackId(const AttackDefinition &definition)
  {
    return static_cast<uint8_t>(definition.Direction) & 0x0f;
  }
}

ActiveAttackComponent *ActiveAttackComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *component = Get(entityId);
  if (component)
    return component;
  return TypedComponentManager<ActiveAttackComponent>::Add(entityId, owner);
}

bool ActiveAttackComponentManager::StartAttack(uint32_t entityId, AttackDirection direction,
                                               CombatBodyComponentManager *bodyMgr,
                                               CombatStateComponentManager *stateMgr,
                                               GameWorldEngine &engine)
{
  auto *component = Get(entityId);
  if (!component || !component->Owner || !bodyMgr || !bodyMgr->CanAttack(entityId))
    return false;
  if (component->Active || direction == AttackDirection::None)
    return false;

  const AttackDefinition &definition = GetAttackDefinition(direction);
  component->Active = true;
  component->Type = definition.Type;
  component->Direction = direction;
  component->TotalTicks = definition.TotalTicks;
  component->TickIndex = 0;
  component->RemainingTicks = definition.TotalTicks;
  component->AlreadyHitCount = 0;

  auto *state = stateMgr ? stateMgr->Get(entityId) : nullptr;
  if (state)
  {
    state->AttackEpoch++;
    state->Blocking = false;
    state->ActiveBlock = BlockDirection::None;
    component->Epoch = state->AttackEpoch;
  }
  else
  {
    component->Epoch++;
  }

  engine.CombatEvents.Push(CombatEventWire{
      engine.TickCount,
      entityId,
      0,
      0,
      0,
      static_cast<uint8_t>(CombatEventType::AttackStarted),
      static_cast<uint8_t>(definition.Type),
      static_cast<uint8_t>(direction),
      CombatEventFlagNone,
      component->Epoch,
      GetVisualTrackId(definition),
      0});
  return true;
}

void ActiveAttackComponentManager::StopAttack(uint32_t entityId, uint8_t flags, GameWorldEngine &engine)
{
  auto *component = Get(entityId);
  if (!component || !component->Active)
    return;

  engine.CombatEvents.Push(CombatEventWire{
      engine.TickCount,
      entityId,
      0,
      0,
      0,
      static_cast<uint8_t>(CombatEventType::AttackStopped),
      static_cast<uint8_t>(component->Type),
      static_cast<uint8_t>(component->Direction),
      flags,
      component->Epoch,
      static_cast<uint8_t>(static_cast<uint8_t>(component->Direction) & 0x0f),
      0});

  component->Active = false;
  component->Type = AttackType::None;
  component->Direction = AttackDirection::None;
  component->TotalTicks = 0;
  component->TickIndex = 0;
  component->RemainingTicks = 0;
  component->AlreadyHitCount = 0;
}

void ActiveAttackComponentManager::Tick(GameWorldEngine &engine,
                                        CombatBodyComponentManager *bodyMgr,
                                        CombatStateComponentManager *stateMgr)
{
  if (!bodyMgr)
    return;

  for (uint32_t attackerId = 1; attackerId < _pool.size(); ++attackerId)
  {
    auto *attack = Get(attackerId);
    if (!attack || !attack->Active || !attack->Owner)
      continue;

    if (!bodyMgr->CanAttack(attackerId))
    {
      StopAttack(attackerId, CombatEventFlagStateChanged, engine);
      continue;
    }

    const AttackDefinition &definition = GetAttackDefinition(attack->Direction);
    if (attack->TickIndex >= definition.TotalTicks)
    {
      StopAttack(attackerId, CombatEventFlagNaturalEnd, engine);
      continue;
    }

    const AttackStepSample &currentStep = definition.Steps[attack->TickIndex];
    const AttackStepSample &previousStep = definition.Steps[attack->TickIndex == 0 ? 0 : attack->TickIndex - 1];

    if (attack->TickIndex > 0 && definition.IsActive(attack->TickIndex) && currentStep.Energy > float32(0))
    {
      const Basis2 attackerBasis = GetBasis(attack->Owner);
      const CombatPoint prevHiltWorld = LocalToWorld(attack->Owner, attackerBasis, ToCombatPoint(previousStep.Hilt));
      const CombatPoint prevTipWorld = LocalToWorld(attack->Owner, attackerBasis, ToCombatPoint(previousStep.Tip));
      const CombatPoint currHiltWorld = LocalToWorld(attack->Owner, attackerBasis, ToCombatPoint(currentStep.Hilt));
      const CombatPoint currTipWorld = LocalToWorld(attack->Owner, attackerBasis, ToCombatPoint(currentStep.Tip));

      const CombatAabb attackAabb = BuildSweepAabb(prevHiltWorld, prevTipWorld, currHiltWorld, currTipWorld);

      std::array<PendingHitCandidate, MAX_STEP_HIT_CANDIDATES> candidates{};
      size_t candidateCount = 0;

      const auto &bodyPool = bodyMgr->GetPool();
      for (uint32_t victimId = 1; victimId < bodyPool.size(); ++victimId)
      {
        if (victimId == attackerId)
          continue;

        auto *victimBody = bodyMgr->Get(victimId);
        auto *victimObject = engine.ObjectManager.GetById(victimId);
        if (!victimBody || !victimObject || victimObject->IsPendingDestruction)
          continue;
        if (victimObject->Transform.Position().Z != attack->Owner->Transform.Position().Z)
          continue;

        if (!AabbOverlaps(attackAabb, BuildBodyAabb(victimObject)))
          continue;

        const Basis2 defenderBasis = GetBasis(victimObject);
        const CombatPoint prevHiltLocal = WorldToLocal(victimObject, defenderBasis, prevHiltWorld);
        const CombatPoint prevTipLocal = WorldToLocal(victimObject, defenderBasis, prevTipWorld);
        const CombatPoint currHiltLocal = WorldToLocal(victimObject, defenderBasis, currHiltWorld);
        const CombatPoint currTipLocal = WorldToLocal(victimObject, defenderBasis, currTipWorld);
        const BlockDirection incomingDirection = ResolveIncomingBlockDirection(attack->Owner, victimObject, defenderBasis, attack->Direction);
        auto *combatState = stateMgr ? stateMgr->Get(victimId) : nullptr;

        bool shieldMatched = false;
        if (combatState && combatState->Blocking &&
            CanStandardBlockDirection(combatState->ActiveBlock, incomingDirection) &&
            bodyMgr->CanBlock(victimId) &&
            !AlreadyHitPart(*attack, victimId, BodyPart::Shield))
        {
          const auto &shield = kOuterHurtboxes.back();
          if (HurtboxIntersectsSweep(shield, prevHiltLocal, prevTipLocal, currHiltLocal, currTipLocal))
          {
            shieldMatched = true;
            auto *shieldState = bodyMgr->GetPartState(victimId, BodyPart::Shield);
            if (shieldState && candidateCount < candidates.size())
            {
              const CombatPoint shieldCenter = GetHurtboxCenter(shield);
              const float32 bladeDistance = SegmentDistanceSquared(currHiltLocal, currTipLocal, shieldCenter);
              const float32 bladeT = ClampFixed(
                  Dot(SubPoint(shieldCenter, currHiltLocal), SubPoint(currTipLocal, currHiltLocal)) /
                      (LengthSquared(SubPoint(currTipLocal, currHiltLocal)) + float32(1)),
                  float32(0), float32(1));
              PendingHitCandidate &candidate = candidates[candidateCount++];
              candidate.VictimId = victimId;
              candidate.Part = BodyPart::Shield;
              candidate.RoutedPart = BodyPart::Shield;
              candidate.ProgressKey = SegmentDistanceSquared(prevTipLocal, currTipLocal, shieldCenter);
              candidate.BladeDistanceKey = bladeDistance;
              candidate.Damage = ComputeDamage(definition, currentStep, bladeT, CombatEventFlagNone, currentStep.Energy);
              candidate.StopCost = shieldState->StopPower + SHIELD_STOP_BONUS;
              if (definition.Type == AttackType::Thrust)
                candidate.StopCost += THRUST_SHIELD_STOP_BONUS;
              candidate.RemainingHp = shieldState->Hp;
              candidate.Flags = CombatEventFlagShieldMatched;
              candidate.IsShield = true;
            }
          }
        }

        for (const auto &hurtbox : kOuterHurtboxes)
        {
          const BodyPart hurtboxPart = static_cast<BodyPart>(hurtbox.PartId);
          if (hurtboxPart == BodyPart::Shield)
            continue;

          if (!HurtboxIntersectsSweep(hurtbox, prevHiltLocal, prevTipLocal, currHiltLocal, currTipLocal))
            continue;

          BodyPart routedPart = hurtboxPart;
          CombatPoint hurtboxCenter = GetHurtboxCenter(hurtbox);
          CombatPoint bladeDelta = SubPoint(currTipLocal, currHiltLocal);
          const float32 bladeLenSq = LengthSquared(bladeDelta);
          float32 bladeT = float32(0);
          if (bladeLenSq > float32(0))
          {
            bladeT = ClampFixed(Dot(SubPoint(hurtboxCenter, currHiltLocal), bladeDelta) / bladeLenSq, float32(0), float32(1));
          }
          CombatPoint impactLocal = AddPoint(currHiltLocal, ScalePoint(bladeDelta, bladeT));
          if (hurtboxPart == BodyPart::Torso)
            routedPart = RouteTorsoVirtual(impactLocal);

          if (AlreadyHitPart(*attack, victimId, routedPart))
            continue;

          auto *partState = bodyMgr->GetPartState(victimId, routedPart);
          auto *outerState = bodyMgr->GetPartState(victimId, hurtboxPart);
          if (!partState || !outerState)
            continue;

          if (candidateCount >= candidates.size())
            break;

          PendingHitCandidate &candidate = candidates[candidateCount++];
          candidate.VictimId = victimId;
          candidate.Part = hurtboxPart;
          candidate.RoutedPart = routedPart;
          candidate.ProgressKey = SegmentDistanceSquared(prevTipLocal, currTipLocal, hurtboxCenter);
          candidate.BladeDistanceKey = SegmentDistanceSquared(currHiltLocal, currTipLocal, hurtboxCenter);
          candidate.Flags = ComputeIncomingFlags(attack->Owner, victimObject, defenderBasis);
          candidate.Damage = ComputeDamage(definition, currentStep, bladeT, candidate.Flags, currentStep.Energy);
          candidate.StopCost = outerState->StopPower;
          if (routedPart != hurtboxPart)
            candidate.StopCost += partState->StopPower / float32(2);
          candidate.RemainingHp = partState->Hp;
          candidate.IsShield = false;
        }
      }

      std::sort(candidates.begin(), candidates.begin() + candidateCount, CandidateLess);

      float32 remainingEnergy = currentStep.Energy;
      for (size_t i = 0; i < candidateCount && attack->Active; ++i)
      {
        PendingHitCandidate &candidate = candidates[i];
        if (remainingEnergy <= float32(0))
        {
          StopAttack(attackerId, CombatEventFlagEnergyStopped, engine);
          break;
        }

        auto *partState = bodyMgr->GetPartState(candidate.VictimId, candidate.RoutedPart);
        if (!partState || partState->Hp <= float32(0))
          continue;
        if (AlreadyHitPart(*attack, candidate.VictimId, candidate.RoutedPart))
          continue;

        const bool wasDisabled = (partState->Flags & PartFlagDisabled) != 0 || partState->Hp <= float32(0);
        const float32 appliedDamage = candidate.Damage;
        bodyMgr->ApplyDamage(candidate.VictimId, candidate.RoutedPart, appliedDamage);
        stateMgr->RefreshAvailability(candidate.VictimId, bodyMgr);
        partState = bodyMgr->GetPartState(candidate.VictimId, candidate.RoutedPart);
        RecordHit(*attack, candidate.VictimId, candidate.RoutedPart);

        engine.CombatEvents.Push(CombatEventWire{
            engine.TickCount,
            attackerId,
            candidate.VictimId,
            appliedDamage.raw_value(),
            partState ? partState->Hp.raw_value() : 0,
            static_cast<uint8_t>(candidate.IsShield ? CombatEventType::Blocked : CombatEventType::HitLanded),
            static_cast<uint8_t>(candidate.Part),
            static_cast<uint8_t>(candidate.RoutedPart),
            candidate.Flags,
            attack->Epoch,
            GetVisualTrackId(definition),
            0});

        if (!wasDisabled && partState && partState->Hp <= float32(0))
        {
          engine.CombatEvents.Push(CombatEventWire{
              engine.TickCount,
              attackerId,
              candidate.VictimId,
              0,
              0,
              static_cast<uint8_t>(CombatEventType::PartDisabled),
              static_cast<uint8_t>(candidate.RoutedPart),
              static_cast<uint8_t>(candidate.RoutedPart),
              CombatEventFlagStateChanged,
              attack->Epoch,
              GetVisualTrackId(definition),
              0});
        }

        if (remainingEnergy > candidate.StopCost)
        {
          remainingEnergy -= candidate.StopCost;
        }
        else
        {
          remainingEnergy = float32(0);
          StopAttack(attackerId, static_cast<uint8_t>(CombatEventFlagEnergyStopped | candidate.Flags), engine);
        }
      }
    }

    if (!attack->Active)
      continue;

    attack->TickIndex++;
    attack->RemainingTicks = attack->TickIndex < definition.TotalTicks
                                 ? static_cast<uint8_t>(definition.TotalTicks - attack->TickIndex)
                                 : 0;

    if (attack->TickIndex >= definition.TotalTicks)
    {
      StopAttack(attackerId, CombatEventFlagNaturalEnd, engine);
    }
  }
}
