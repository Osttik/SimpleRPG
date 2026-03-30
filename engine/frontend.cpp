#include <cstdint>
#include <cstdlib>
#include <emscripten/bind.h>
#include "net/protocol.hpp"

using namespace emscripten;

static uint8_t encoding_buffer[64];

uintptr_t allocateBuffer(size_t size)
{
  return reinterpret_cast<uintptr_t>(malloc(size));
}

void freeBuffer(uintptr_t ptr)
{
  free(reinterpret_cast<void *>(ptr));
}

val getBufferView(uintptr_t ptr, size_t size)
{
  return val(typed_memory_view(size, reinterpret_cast<uint8_t *>(ptr)));
}

val encodeMove(int8_t dx, int8_t dy, uint16_t seq)
{
  MovePacket *pkt = reinterpret_cast<MovePacket *>(encoding_buffer);
  pkt->type = NETMessageType::Move;
  pkt->dx = dx;
  pkt->dy = dy;
  pkt->seq = seq;
  return val(typed_memory_view(sizeof(MovePacket), encoding_buffer));
}

val encodeInteract()
{
  InteractPacket *pkt = reinterpret_cast<InteractPacket *>(encoding_buffer);
  pkt->type = NETMessageType::Interact;
  return val(typed_memory_view(sizeof(InteractPacket), encoding_buffer));
}

val encodeTransfer(uint32_t targetId, uint8_t from, uint8_t to, uint16_t idx)
{
  TransferPacket *pkt = reinterpret_cast<TransferPacket *>(encoding_buffer);
  pkt->type = NETMessageType::Transfer;
  pkt->targetId = targetId;
  pkt->from = from;
  pkt->to = to;
  pkt->idx = idx;
  pkt->pad = 0;
  return val(typed_memory_view(sizeof(TransferPacket), encoding_buffer));
}

val decodeSnapshot(uintptr_t ptr, size_t length)
{
  if (length < sizeof(SnapshotHeader))
    return val::null();

  const uint8_t *base = reinterpret_cast<const uint8_t *>(ptr);
  const SnapshotHeader *header = reinterpret_cast<const SnapshotHeader *>(base);

  if (header->magic != 0x53525047)
    return val::null();

  val result = val::object();
  result.set("tick", header->tick);

  val playersObj = val::object();

  size_t offset = sizeof(SnapshotHeader);

  // Parse Players
  for (uint16_t i = 0; i < header->playerCount; i++)
  {
    if (offset + sizeof(EntityState) > length)
      break;
    const EntityState *state = reinterpret_cast<const EntityState *>(base + offset);

    val p = val::object();
    p.set("numericId", state->id);
    p.set("x", state->x / 65536.0);
    p.set("y", state->y / 65536.0);
    p.set("radius", state->radius / 65536.0);
    p.set("focusedIdNum", state->focusedId);
    p.set("typeId", state->type);
    p.set("z", state->chunkZ);
    p.set("flags", state->flags);
    p.set("animState", state->animState);
    playersObj.set(std::to_string(state->id), p);

    offset += sizeof(EntityState);
  }

  // Parse Props identical to players
  for (uint16_t i = 0; i < header->propCount; i++)
  {
    if (offset + sizeof(EntityState) > length)
      break;
    const EntityState *state = reinterpret_cast<const EntityState *>(base + offset);

    val p = val::object();
    p.set("numericId", state->id);
    p.set("x", state->x / 65536.0);
    p.set("y", state->y / 65536.0);
    p.set("radius", state->radius / 65536.0);
    p.set("focusedIdNum", state->focusedId);
    p.set("typeId", state->type);
    p.set("z", state->chunkZ);
    p.set("flags", state->flags);
    p.set("animState", state->animState);
    playersObj.set(std::to_string(state->id), p);

    offset += sizeof(EntityState);
  }

  val destroyedArr = val::array();
  for (uint16_t i = 0; i < header->destroyedCount; i++)
  {
    if (offset + sizeof(uint32_t) > length)
      break;
    uint32_t dId = *reinterpret_cast<const uint32_t *>(base + offset);
    destroyedArr.call<void>("push", dId);
    offset += sizeof(uint32_t);
  }

  result.set("players", playersObj);
  result.set("destroyed", destroyedArr);

  return result;
}

EMSCRIPTEN_BINDINGS(protocol_module)
{
  function("encodeMove", &encodeMove);
  function("encodeInteract", &encodeInteract);
  function("encodeTransfer", &encodeTransfer);
  function("decodeSnapshot", &decodeSnapshot);
  function("allocateBuffer", &allocateBuffer);
  function("freeBuffer", &freeBuffer);
  function("getBufferView", &getBufferView);
}