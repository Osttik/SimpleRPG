#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

constexpr uint8_t COMBAT_EVENT_MESSAGE_TYPE = 0x12;
constexpr size_t MAX_COMBAT_EVENTS_PER_TICK = 128;

enum class CombatEventType : uint8_t
{
  AttackStarted = 0,
  HitLanded = 1,
  Blocked = 2,
  AttackStopped = 3,
  PartDisabled = 4
};

enum CombatEventFlags : uint8_t
{
  CombatEventFlagNone = 0,
  CombatEventFlagBackHit = 1 << 0,
  CombatEventFlagEnergyStopped = 1 << 1,
  CombatEventFlagShieldMatched = 1 << 2,
  CombatEventFlagNaturalEnd = 1 << 3,
  CombatEventFlagStateChanged = 1 << 4
};

#pragma pack(push, 1)
struct CombatEventHeader
{
  uint8_t type = COMBAT_EVENT_MESSAGE_TYPE;
  uint16_t count = 0;
  uint8_t reserved = 0;
};

struct CombatEventWire
{
  uint32_t tick = 0;
  uint32_t attackerId = 0;
  uint32_t victimId = 0;
  int32_t damageRaw = 0;
  int32_t remainingHpRaw = 0;
  uint8_t eventType = 0;
  uint8_t partId = 0;
  uint8_t routedPartId = 0;
  uint8_t flags = 0;
};
#pragma pack(pop)

class CombatEventBuffer
{
private:
  std::array<CombatEventWire, MAX_COMBAT_EVENTS_PER_TICK> _events{};
  uint16_t _count = 0;

public:
  void Clear() { _count = 0; }
  bool Empty() const { return _count == 0; }
  uint16_t Count() const { return _count; }

  void Push(const CombatEventWire &event)
  {
    if (_count >= MAX_COMBAT_EVENTS_PER_TICK)
      return;
    _events[_count++] = event;
  }

  std::vector<uint8_t> SerializeAndClear()
  {
    CombatEventHeader header;
    header.count = _count;

    std::vector<uint8_t> bytes(sizeof(CombatEventHeader) + (sizeof(CombatEventWire) * _count), 0);
    std::memcpy(bytes.data(), &header, sizeof(CombatEventHeader));
    if (_count > 0)
    {
      std::memcpy(bytes.data() + sizeof(CombatEventHeader), _events.data(), sizeof(CombatEventWire) * _count);
    }

    Clear();
    return bytes;
  }
};
