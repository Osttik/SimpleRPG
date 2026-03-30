#pragma once
#include <cstdint>

constexpr int CHUNK_SIZE = 16;
constexpr int CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

// 16x16x16 = 4096 tiles
struct Chunk {
  uint16_t tiles[CHUNK_VOLUME];
  uint8_t visual_mask_layer[CHUNK_VOLUME];
};
