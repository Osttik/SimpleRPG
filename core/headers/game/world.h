#pragma once
#include <unordered_map>
#include <tuple>
#include "game/chunk.h"

struct ChunkCoordHash {
  std::size_t operator()(const std::tuple<int32_t, int32_t, int32_t>& k) const {
    auto [x, y, z] = k;
    return std::hash<int32_t>{}(x) ^ (std::hash<int32_t>{}(y) << 1) ^ (std::hash<int32_t>{}(z) << 2);
  }
};

class WorldManager {
public:
  WorldManager();
  ~WorldManager() = default;

  Chunk* GetChunk(int32_t cx, int32_t cy, int32_t cz);

private:
  void GenerateChunk(int32_t cx, int32_t cy, int32_t cz, Chunk* chunk);
  std::unordered_map<std::tuple<int32_t, int32_t, int32_t>, Chunk, ChunkCoordHash> chunks_;
};
