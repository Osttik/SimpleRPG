#pragma once

#include <cstdint>
#include <cstring>
#include <vector>
#include "core/combat/body-parts.h"
#include "math/number.h"

// ─── Body-State Manifest Wire Format ────────────────────────────────────────
//
// Cold-path message sent on: first join, reconnect, chunk-enter visibility,
// and explicit repair responses. NOT sent every tick.
//
// Wire byte: 0x13
//
// Header (4 bytes):
//   Offset  Size  Field
//     0      1    type           (0x13)
//     1      2    entityCount    (uint16_t LE)
//     3      1    reserved
//
// Per-entity entry (16 bytes):
//   Offset  Size  Field
//     0      4    entityId         (uint32_t)
//     4      2    bodyStateVersion (uint16_t)
//     6      1    shieldState      (uint8_t enum: 0=intact, 1=damaged, 2=broken)
//     7      1    functionalFlags  (uint8_t)
//     8      4    disabledParts    (uint32_t bitmask, bit N = body part N disabled)
//    12      4    hiddenParts      (uint32_t bitmask, bit N = body part N hidden)
// Total: 16 bytes per entity

constexpr uint8_t BODY_STATE_MANIFEST_MESSAGE_TYPE = 0x13;
constexpr size_t BODY_STATE_MANIFEST_HEADER_SIZE = 4;
constexpr size_t BODY_STATE_MANIFEST_ENTRY_SIZE = 16;

enum class ShieldVisualState : uint8_t
{
  Intact = 0,
  Damaged = 1,
  Broken = 2
};

#pragma pack(push, 1)
struct BodyStateManifestHeader
{
  uint8_t type = BODY_STATE_MANIFEST_MESSAGE_TYPE;
  uint16_t entityCount = 0;
  uint8_t reserved = 0;
};

struct BodyStateManifestEntry
{
  uint32_t entityId = 0;
  uint16_t bodyStateVersion = 0;
  uint8_t shieldState = 0;
  uint8_t functionalFlags = 0;
  uint32_t disabledParts = 0;
  uint32_t hiddenParts = 0;
};
#pragma pack(pop)

static_assert(sizeof(BodyStateManifestHeader) == BODY_STATE_MANIFEST_HEADER_SIZE);
static_assert(sizeof(BodyStateManifestEntry) == BODY_STATE_MANIFEST_ENTRY_SIZE);

class CombatBodyComponentManager;

inline ShieldVisualState ComputeShieldVisualState(const CombatPartState &shieldPart)
{
  if (shieldPart.Integrity <= float32(CombatRigContract::Shield.BreakThreshold) ||
      (shieldPart.Flags & PartFlagDisabled) != 0)
  {
    return ShieldVisualState::Broken;
  }
  if (shieldPart.Integrity < shieldPart.MaxIntegrity)
  {
    return ShieldVisualState::Damaged;
  }
  return ShieldVisualState::Intact;
}
