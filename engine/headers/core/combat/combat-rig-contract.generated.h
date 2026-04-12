#pragma once

#include <array>
#include <cstdint>

namespace CombatRigContract
{
constexpr const char *ContractId = "humanoid_base";
constexpr const char *ContractHash = "796130ca252b0e01";
constexpr uint32_t ContractVersion = 1;
constexpr float FrontendScale = 1;

constexpr uint8_t BodyPartHead = 0;
constexpr uint8_t BodyPartNeck = 1;
constexpr uint8_t BodyPartTorso = 2;
constexpr uint8_t BodyPartChestVirtual = 3;
constexpr uint8_t BodyPartBellyVirtual = 4;
constexpr uint8_t BodyPartPelvisVirtual = 5;
constexpr uint8_t BodyPartShoulderL = 6;
constexpr uint8_t BodyPartUpperArmL = 7;
constexpr uint8_t BodyPartForearmHandL = 8;
constexpr uint8_t BodyPartShoulderR = 9;
constexpr uint8_t BodyPartUpperArmR = 10;
constexpr uint8_t BodyPartForearmHandR = 11;
constexpr uint8_t BodyPartThighL = 12;
constexpr uint8_t BodyPartShinFootL = 13;
constexpr uint8_t BodyPartThighR = 14;
constexpr uint8_t BodyPartShinFootR = 15;
constexpr uint8_t BodyPartShield = 16;
constexpr uint8_t BodyPartCount = 17;

enum class HurtboxPrimitive : uint8_t
{
  Circle = 0,
  Box = 1
};

struct BodyPartDefinition
{
  uint8_t Id;
  const char *Key;
  int16_t MaxHp;
  int16_t StopPower;
  uint8_t Layer;
};

struct HurtboxDefinition
{
  uint8_t PartId;
  HurtboxPrimitive Primitive;
  int16_t A;
  int16_t B;
  int16_t C;
  int16_t D;
};

struct ShieldStructuralDefaults
{
  uint8_t PartId;
  int16_t MaxIntegrity;
  int16_t DefaultIntegrity;
  int16_t StopPower;
  int16_t BreakThreshold;
};

constexpr std::array<BodyPartDefinition, BodyPartCount> BodyParts = {{
    BodyPartDefinition{0, "Head", 32, 14, 0},
    BodyPartDefinition{1, "Neck", 18, 10, 0},
    BodyPartDefinition{2, "Torso", 60, 12, 0},
    BodyPartDefinition{3, "ChestVirtual", 54, 14, 1},
    BodyPartDefinition{4, "BellyVirtual", 50, 11, 1},
    BodyPartDefinition{5, "PelvisVirtual", 56, 15, 1},
    BodyPartDefinition{6, "ShoulderL", 26, 8, 0},
    BodyPartDefinition{7, "UpperArmL", 28, 9, 0},
    BodyPartDefinition{8, "ForearmHandL", 24, 8, 0},
    BodyPartDefinition{9, "ShoulderR", 26, 8, 0},
    BodyPartDefinition{10, "UpperArmR", 28, 9, 0},
    BodyPartDefinition{11, "ForearmHandR", 24, 8, 0},
    BodyPartDefinition{12, "ThighL", 34, 11, 0},
    BodyPartDefinition{13, "ShinFootL", 30, 9, 0},
    BodyPartDefinition{14, "ThighR", 34, 11, 0},
    BodyPartDefinition{15, "ShinFootR", 30, 9, 0},
    BodyPartDefinition{16, "Shield", 48, 26, 0},
}};

constexpr std::array<HurtboxDefinition, 14> OuterHurtboxes = {{
    HurtboxDefinition{0, HurtboxPrimitive::Circle, 0, 18, 6, 0},
    HurtboxDefinition{1, HurtboxPrimitive::Box, -3, 10, 3, 16},
    HurtboxDefinition{2, HurtboxPrimitive::Box, -8, -10, 8, 10},
    HurtboxDefinition{6, HurtboxPrimitive::Circle, -11, 7, 4, 0},
    HurtboxDefinition{7, HurtboxPrimitive::Box, -20, -1, -10, 6},
    HurtboxDefinition{8, HurtboxPrimitive::Box, -28, -5, -18, 4},
    HurtboxDefinition{9, HurtboxPrimitive::Circle, 11, 7, 4, 0},
    HurtboxDefinition{10, HurtboxPrimitive::Box, 10, -1, 20, 6},
    HurtboxDefinition{11, HurtboxPrimitive::Box, 18, -5, 28, 4},
    HurtboxDefinition{12, HurtboxPrimitive::Box, -7, -22, -1, -10},
    HurtboxDefinition{13, HurtboxPrimitive::Box, -9, -35, -2, -22},
    HurtboxDefinition{14, HurtboxPrimitive::Box, 1, -22, 7, -10},
    HurtboxDefinition{15, HurtboxPrimitive::Box, 2, -35, 9, -22},
    HurtboxDefinition{16, HurtboxPrimitive::Box, -16, -24, 16, 24},
}};

constexpr std::array<uint8_t, 2> LeftLegParts = {12, 13};
constexpr std::array<uint8_t, 2> RightLegParts = {14, 15};
constexpr std::array<uint8_t, 3> AttackRequiredParts = {9, 10, 11};
constexpr std::array<uint8_t, 4> BlockRequiredParts = {6, 7, 8, 16};

constexpr uint8_t ChestVirtualPart = 3;
constexpr uint8_t BellyVirtualPart = 4;
constexpr uint8_t PelvisVirtualPart = 5;
constexpr int16_t ChestMinYExclusive = 4;
constexpr int16_t PelvisMaxYExclusive = -4;

constexpr ShieldStructuralDefaults Shield = {
    16,
    96,
    96,
    26,
    1,
};
}
