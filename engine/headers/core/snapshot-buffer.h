#pragma once
#include <cstdint>
#include <cstring>
#include <vector>

// ─── Per-Entity Binary Layout (32 bytes fixed) ───
// Offset  Size   Field
//   0      4     entityId      (uint32_t)
//   4      4     x             (int32_t — raw fixed-point bits)
//   8      4     y             (int32_t — raw fixed-point bits)
//  12      4     radius        (int32_t — raw fixed-point bits)
//  16      4     focusedEntityId (uint32_t, 0 = none)
//  20      1     entityType    (uint8_t: 0=player, 1=chest, 2=npc…)
//  21      1     chunkZ        (int8_t)
//  22      1     flags         (bitfield: bit0=isDestroyed, bit1=hasInventory…)
//  23      1     animState     (uint8_t)
//  24      4     colorPacked   (uint32_t RGBA8888)
//  28      4     reserved
// Total: 32 bytes per entity

constexpr size_t ENTITY_STRIDE = 32;
constexpr size_t MAX_SNAPSHOT_ENTITIES = 512;

// ─── Snapshot Header (16 bytes) ───
// Offset  Size   Field
//   0      4     magic         (0x53525047 = "SRPG")
//   4      4     tick          (uint32_t, monotonic)
//   8      2     playerCount   (uint16_t)
//  10      2     propCount     (uint16_t)
//  12      2     destroyedCount(uint16_t)
//  14      2     reserved

constexpr size_t SNAPSHOT_HEADER_SIZE = 16;
constexpr uint32_t SNAPSHOT_MAGIC = 0x53525047;

class SnapshotBuffer {
public:
    SnapshotBuffer() {
        size_t bufSize = SNAPSHOT_HEADER_SIZE
                       + (MAX_SNAPSHOT_ENTITIES * ENTITY_STRIDE)
                       + (MAX_SNAPSHOT_ENTITIES * sizeof(uint32_t)); // destroyed IDs
        buffers_[0].resize(bufSize, 0);
        buffers_[1].resize(bufSize, 0);
    }

    // Physics tick writes into this buffer
    uint8_t* GetWriteBuffer() { return buffers_[writeIndex_].data(); }

    // Swap — makes freshly written buffer available for reading
    void Swap() { writeIndex_ ^= 1; }

    // N-API reads from this buffer (the one NOT being written to)
    const uint8_t* GetReadBuffer() const { return buffers_[writeIndex_ ^ 1].data(); }

    // Compute actual payload size from the header of the read buffer
    size_t GetReadPayloadSize() const {
        const uint8_t* buf = GetReadBuffer();
        uint16_t playerCount, propCount, destroyedCount;
        std::memcpy(&playerCount,   buf + 8,  2);
        std::memcpy(&propCount,     buf + 10, 2);
        std::memcpy(&destroyedCount, buf + 12, 2);
        return SNAPSHOT_HEADER_SIZE
             + static_cast<size_t>(playerCount + propCount) * ENTITY_STRIDE
             + static_cast<size_t>(destroyedCount) * sizeof(uint32_t);
    }

private:
    std::vector<uint8_t> buffers_[2];
    int writeIndex_ = 0;
};
