#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include "core/materials.h"

enum class WorkpieceStage : uint8_t
{
  RawStock = 0,
  HeatedStock = 1,
  CastBlank = 2,
  ShapedPart = 3,
  AssembledItem = 4,
  BrokenScrap = 5,
};

enum class ConnectionSide : uint8_t
{
  None = 0,
  Top = 1,
  Bottom = 2,
  Left = 3,
  Right = 4,
};

enum class PartOrientation : uint8_t
{
  None = 0,
  Horizontal = 1,
  Vertical = 2,
};

enum class WorkpieceInvalidReason : uint8_t
{
  None = 0,
  Fractured = 1,
  Oversharpened = 2,
  Undersized = 3,
  ThermalFailure = 4,
  JoinMismatch = 5,
};

enum class RuntimeRegionType : uint8_t
{
  Shaft = 0,
  Head = 1,
  Edge = 2,
  Point = 3,
};

struct JoinPointState
{
  int16_t X = 0;
  int16_t Y = 0;
  ConnectionSide Side = ConnectionSide::None;
  PartOrientation Orientation = PartOrientation::None;
  bool Occupied = false;
};

struct JoinedPartDescriptor
{
  std::string DefinitionId;
  MaterialId Material = MaterialId::None;
  ConnectionSide Side = ConnectionSide::None;
  PartOrientation Orientation = PartOrientation::None;
  int32_t Width = 0;
  int32_t Height = 0;
};

struct RuntimeRegion
{
  RuntimeRegionType Type = RuntimeRegionType::Shaft;
  int16_t MinX = 0;
  int16_t MinY = 0;
  int16_t MaxX = 0;
  int16_t MaxY = 0;
};

struct WorkpieceState
{
  uint16_t Version = 2;
  WorkpieceStage Stage = WorkpieceStage::RawStock;
  MaterialId Material = MaterialId::None;
  uint16_t ProfileWidth = 0;
  uint16_t ProfileHeight = 0;
  std::vector<uint8_t> ProfileMask;
  int32_t ThicknessRaw = 0;
  int32_t TemperatureRaw = 0;
  uint16_t Quality = 100;
  bool Fractured = false;
  bool Broken = false;
  WorkpieceInvalidReason InvalidReason = WorkpieceInvalidReason::None;
  std::vector<uint8_t> SharpnessMaskTop;
  std::vector<uint8_t> SharpnessMaskBottom;
  std::vector<uint8_t> SharpnessMaskLeft;
  std::vector<uint8_t> SharpnessMaskRight;
  std::vector<uint16_t> StrainMap;
  std::vector<uint16_t> DamageMap;
  std::vector<uint8_t> WeaknessMap;
  std::vector<JoinPointState> JoinPoints;
  std::vector<ConnectionSide> ConnectionSides;
  PartOrientation Orientation = PartOrientation::None;
  std::vector<JoinedPartDescriptor> JoinedParts;
  uint16_t JoinPreparationQuality = 0;
  uint16_t JoinQuality = 0;
  uint16_t JoinedFitScore = 0;
  uint16_t JoinMaterialScore = 0;
  uint16_t JoinWeaknessPenalty = 0;
  int32_t MassRaw = 0;
  int32_t CenterOfMassXRaw = 0;
  int32_t CenterOfMassYRaw = 0;
  int32_t EffectiveReachRaw = 0;
  int32_t SwingEfficiency = 0;
  int32_t ThrustEfficiency = 0;
  int32_t DiggingEfficiency = 0;
  int32_t CuttingEffectiveness = 0;
  int32_t PiercingEffectiveness = 0;
  int32_t BluntEffectiveness = 0;
  int32_t StopOnHit = 0;
  int32_t Durability = 0;
  int32_t BreakRisk = 0;
  std::vector<RuntimeRegion> RuntimeRegions;
};

enum class MoldSilhouette : uint8_t
{
  BladeBlank = 0,
  HammerHeadBlank = 1,
  ShaftBlank = 2,
  ShovelBlank = 3,
  SpikeBlank = 4,
};

enum class BendZone : uint8_t
{
  Center = 0,
  Top = 1,
  Bottom = 2,
};

enum class SharpenSide : uint8_t
{
  Top = 0,
  Bottom = 1,
  Left = 2,
  Right = 3,
};

enum class ForgeZone : uint8_t
{
  Center = 0,
  Top = 1,
  Bottom = 2,
};
