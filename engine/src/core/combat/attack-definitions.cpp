#include "core/combat/attack-definitions.h"

namespace
{
  constexpr float32 kOne = float32(1);

  CombatLocalPoint P(int x, int y)
  {
    return CombatLocalPoint{float32(x), float32(y)};
  }

  AttackStepSample MakeStep(int hiltX, int hiltY, int tipX, int tipY, int energy, int damagePercent)
  {
    AttackStepSample sample;
    sample.Hilt = P(hiltX, hiltY);
    sample.Tip = P(tipX, tipY);
    sample.Energy = float32(energy);
    sample.DamageMultiplier = float32(damagePercent) / float32(100);
    return sample;
  }

  uint64_t BuildActiveMask(uint8_t fromInclusive, uint8_t toInclusive)
  {
    uint64_t mask = 0;
    for (uint8_t i = fromInclusive; i <= toInclusive; ++i)
    {
      mask |= (uint64_t(1) << i);
    }
    return mask;
  }

  AttackDefinition MakeSlashLeftToRight()
  {
    AttackDefinition def;
    def.Type = AttackType::Slash;
    def.Direction = AttackDirection::SlashLeftToRight;
    def.TotalTicks = 30;
    def.ActiveMask = BuildActiveMask(8, 20);
    def.BaseDamage = float32(18);

    const AttackStepSample samples[] = {
        MakeStep(-9, -4, -20, 18, 8, 65),
        MakeStep(-9, -3, -20, 18, 8, 68),
        MakeStep(-9, -2, -19, 19, 9, 70),
        MakeStep(-8, -1, -18, 20, 10, 72),
        MakeStep(-8, 0, -17, 20, 11, 75),
        MakeStep(-7, 1, -15, 21, 12, 80),
        MakeStep(-6, 2, -13, 21, 14, 86),
        MakeStep(-5, 3, -10, 21, 16, 94),
        MakeStep(-4, 4, -6, 20, 19, 100),
        MakeStep(-3, 5, -2, 18, 21, 105),
        MakeStep(-2, 5, 2, 16, 24, 110),
        MakeStep(-1, 5, 6, 13, 26, 114),
        MakeStep(0, 5, 10, 10, 28, 118),
        MakeStep(1, 4, 14, 7, 30, 120),
        MakeStep(2, 4, 18, 4, 30, 118),
        MakeStep(3, 3, 21, 1, 28, 115),
        MakeStep(4, 2, 23, -2, 25, 110),
        MakeStep(5, 1, 24, -4, 22, 104),
        MakeStep(6, 0, 24, -6, 18, 96),
        MakeStep(7, -1, 23, -8, 15, 88),
        MakeStep(8, -2, 21, -10, 12, 80),
        MakeStep(8, -3, 19, -11, 10, 74),
        MakeStep(8, -4, 17, -12, 9, 70),
        MakeStep(8, -5, 15, -12, 8, 68),
        MakeStep(8, -6, 13, -12, 8, 66),
        MakeStep(8, -6, 12, -12, 7, 64),
        MakeStep(8, -6, 11, -12, 7, 62),
        MakeStep(8, -6, 10, -12, 6, 60),
        MakeStep(8, -6, 10, -12, 6, 58),
        MakeStep(8, -6, 10, -12, 6, 55),
    };

    for (size_t i = 0; i < def.TotalTicks; ++i)
    {
      def.Steps[i] = samples[i];
    }
    return def;
  }

  AttackDefinition MakeSlashRightToLeft()
  {
    AttackDefinition def = MakeSlashLeftToRight();
    def.Direction = AttackDirection::SlashRightToLeft;

    for (size_t i = 0; i < def.TotalTicks; ++i)
    {
      def.Steps[i].Hilt.X = float32(0) - def.Steps[i].Hilt.X;
      def.Steps[i].Tip.X = float32(0) - def.Steps[i].Tip.X;
    }
    return def;
  }

  AttackDefinition MakeRisingSlash()
  {
    AttackDefinition def;
    def.Type = AttackType::Slash;
    def.Direction = AttackDirection::RisingSlash;
    def.TotalTicks = 20;
    def.ActiveMask = BuildActiveMask(5, 15);
    def.BaseDamage = float32(20);

    const AttackStepSample samples[] = {
        MakeStep(4, -10, 14, -26, 10, 70),
        MakeStep(4, -10, 14, -24, 10, 72),
        MakeStep(3, -9, 13, -21, 11, 76),
        MakeStep(3, -8, 12, -17, 12, 82),
        MakeStep(2, -7, 10, -12, 14, 90),
        MakeStep(1, -5, 8, -6, 17, 98),
        MakeStep(0, -3, 6, 0, 20, 105),
        MakeStep(-1, -1, 4, 6, 23, 112),
        MakeStep(-2, 1, 2, 12, 25, 118),
        MakeStep(-2, 2, 0, 17, 27, 122),
        MakeStep(-2, 3, -2, 21, 28, 124),
        MakeStep(-2, 4, -4, 24, 27, 120),
        MakeStep(-1, 5, -6, 26, 24, 114),
        MakeStep(0, 5, -7, 27, 20, 106),
        MakeStep(1, 5, -8, 27, 16, 96),
        MakeStep(2, 4, -8, 26, 13, 88),
        MakeStep(3, 3, -8, 24, 11, 80),
        MakeStep(4, 2, -7, 22, 10, 74),
        MakeStep(4, 2, -6, 20, 9, 70),
        MakeStep(4, 2, -6, 20, 8, 66),
    };

    for (size_t i = 0; i < def.TotalTicks; ++i)
    {
      def.Steps[i] = samples[i];
    }
    return def;
  }

  AttackDefinition MakeOverheadSlash()
  {
    AttackDefinition def;
    def.Type = AttackType::Slash;
    def.Direction = AttackDirection::OverheadSlash;
    def.TotalTicks = 40;
    def.ActiveMask = BuildActiveMask(12, 26);
    def.BaseDamage = float32(24);

    const AttackStepSample samples[] = {
        MakeStep(0, -8, 0, 28, 8, 60),
        MakeStep(0, -8, 0, 28, 8, 62),
        MakeStep(0, -8, 0, 28, 8, 64),
        MakeStep(0, -8, 0, 28, 9, 66),
        MakeStep(0, -7, 0, 27, 9, 68),
        MakeStep(0, -7, 1, 25, 10, 70),
        MakeStep(0, -6, 2, 23, 10, 72),
        MakeStep(0, -5, 3, 20, 11, 74),
        MakeStep(0, -4, 4, 17, 12, 78),
        MakeStep(0, -3, 4, 13, 14, 84),
        MakeStep(0, -2, 4, 9, 16, 92),
        MakeStep(0, -1, 3, 5, 18, 100),
        MakeStep(0, 0, 2, 1, 22, 108),
        MakeStep(0, 1, 1, -4, 25, 114),
        MakeStep(0, 2, 0, -9, 28, 120),
        MakeStep(0, 3, -1, -14, 31, 126),
        MakeStep(0, 4, -2, -18, 34, 130),
        MakeStep(0, 5, -3, -22, 35, 132),
        MakeStep(0, 5, -4, -26, 36, 132),
        MakeStep(0, 5, -4, -29, 36, 130),
        MakeStep(0, 5, -4, -31, 35, 126),
        MakeStep(0, 5, -3, -33, 32, 120),
        MakeStep(0, 5, -2, -34, 28, 112),
        MakeStep(0, 4, -1, -34, 24, 104),
        MakeStep(0, 4, 0, -33, 20, 96),
        MakeStep(0, 3, 1, -31, 17, 88),
        MakeStep(0, 2, 2, -28, 14, 82),
        MakeStep(0, 1, 2, -25, 12, 76),
        MakeStep(0, 0, 2, -22, 11, 72),
        MakeStep(0, 0, 2, -20, 10, 70),
        MakeStep(0, 0, 2, -18, 9, 68),
        MakeStep(0, 0, 2, -16, 9, 66),
        MakeStep(0, 0, 2, -15, 8, 64),
        MakeStep(0, 0, 2, -14, 8, 62),
        MakeStep(0, 0, 2, -13, 8, 60),
        MakeStep(0, 0, 2, -12, 7, 58),
        MakeStep(0, 0, 2, -12, 7, 56),
        MakeStep(0, 0, 2, -12, 7, 54),
        MakeStep(0, 0, 2, -12, 7, 52),
        MakeStep(0, 0, 2, -12, 7, 50),
    };

    for (size_t i = 0; i < def.TotalTicks; ++i)
    {
      def.Steps[i] = samples[i];
    }
    return def;
  }

  AttackDefinition MakeThrust()
  {
    AttackDefinition def;
    def.Type = AttackType::Thrust;
    def.Direction = AttackDirection::ThrustFront;
    def.TotalTicks = 20;
    def.ActiveMask = BuildActiveMask(4, 13);
    def.BaseDamage = float32(16);

    const AttackStepSample samples[] = {
        MakeStep(0, -4, 0, 10, 9, 75),
        MakeStep(0, -4, 0, 11, 9, 78),
        MakeStep(0, -4, 0, 13, 10, 82),
        MakeStep(0, -3, 0, 16, 12, 88),
        MakeStep(0, -3, 0, 20, 15, 96),
        MakeStep(0, -2, 0, 24, 19, 104),
        MakeStep(0, -2, 0, 29, 23, 112),
        MakeStep(0, -1, 0, 34, 27, 118),
        MakeStep(0, -1, 0, 39, 30, 122),
        MakeStep(0, 0, 0, 43, 31, 124),
        MakeStep(0, 0, 0, 46, 30, 122),
        MakeStep(0, 0, 0, 48, 27, 118),
        MakeStep(0, 0, 0, 49, 23, 112),
        MakeStep(0, 0, 0, 49, 18, 104),
        MakeStep(0, 0, 0, 45, 14, 96),
        MakeStep(0, 0, 0, 39, 11, 88),
        MakeStep(0, -1, 0, 32, 9, 82),
        MakeStep(0, -2, 0, 25, 8, 78),
        MakeStep(0, -3, 0, 18, 8, 74),
        MakeStep(0, -4, 0, 12, 8, 70),
    };

    for (size_t i = 0; i < def.TotalTicks; ++i)
    {
      def.Steps[i] = samples[i];
    }
    return def;
  }
}

const AttackDefinition &GetAttackDefinition(AttackDirection direction)
{
  static const AttackDefinition slashLeftToRight = MakeSlashLeftToRight();
  static const AttackDefinition slashRightToLeft = MakeSlashRightToLeft();
  static const AttackDefinition risingSlash = MakeRisingSlash();
  static const AttackDefinition overheadSlash = MakeOverheadSlash();
  static const AttackDefinition thrust = MakeThrust();

  switch (direction)
  {
  case AttackDirection::SlashLeftToRight:
    return slashLeftToRight;
  case AttackDirection::SlashRightToLeft:
    return slashRightToLeft;
  case AttackDirection::RisingSlash:
    return risingSlash;
  case AttackDirection::OverheadSlash:
    return overheadSlash;
  case AttackDirection::ThrustFront:
    return thrust;
  case AttackDirection::None:
  default:
    return thrust;
  }
}

