#pragma once
#include <cstdint>

#pragma pack(push, 1)

enum class NETMessageType : uint8_t
{
  Move = 1,
  Interact = 2,
  Transfer = 3
};

struct MovePacket
{
  NETMessageType type;
  int8_t dx;
  int8_t dy;
  uint16_t seq;
};

struct InteractPacket
{
  NETMessageType type;
};

struct TransferPacket
{
  NETMessageType type;
  uint32_t targetId;
  uint8_t from;
  uint8_t to;
  uint16_t idx;
  uint8_t pad;
};

// Snapshot State Layout
struct SnapshotHeader
{
  uint32_t magic;
  uint32_t tick;
  uint16_t playerCount;
  uint16_t propCount;
  uint16_t destroyedCount;
  uint16_t pad;
};

struct EntityState
{
  uint32_t id;
  int32_t x;
  int32_t y;
  int32_t radius;
  uint32_t focusedId;
  uint8_t type;
  int8_t chunkZ;
  uint8_t flags;
  uint8_t animState;
  uint32_t colorPacked;
  uint32_t pad;
};

#pragma pack(pop)