#pragma once
#include <unordered_map>
#include <tuple>
#include "game/chunk.h"
#include "math/aabb.h"
#include "math/point.h"

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

  uint16_t GetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ);
  void NotifyTileChanged(int32_t worldX, int32_t worldY, int32_t worldZ);

  bool CheckTileCollision(const aabb::AABB& box, int32_t z, Point& resolution);

private:
  void GenerateChunk(int32_t cx, int32_t cy, int32_t cz, Chunk* chunk);
  void UpdateTileVisuals(int32_t worldX, int32_t worldY, int32_t worldZ);
  std::unordered_map<std::tuple<int32_t, int32_t, int32_t>, Chunk, ChunkCoordHash> chunks_;
};
