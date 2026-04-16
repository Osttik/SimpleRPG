#pragma once
#include <unordered_map>
#include <unordered_set>
#include <tuple>
#include <vector>
#include "core/chunk.h"
#include "core/terrain-destruction.h"
#include "core/tile-registry.h"
#include "math/aabb.h"
#include "math/point.h"

struct ChunkCoordHash
{
  std::size_t operator()(const std::tuple<int32_t, int32_t, int32_t> &k) const
  {
    auto [x, y, z] = k;
    return std::hash<int32_t>{}(x) ^ (std::hash<int32_t>{}(y) << 1) ^ (std::hash<int32_t>{}(z) << 2);
  }
};

class WorldManager
{
public:
  WorldManager();
  ~WorldManager() = default;

  Chunk *GetChunk(int32_t cx, int32_t cy, int32_t cz);

  uint16_t GetBaseTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) const;
  uint16_t GetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) const;
  void SetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ, uint16_t tileId);
  void NotifyTileChanged(int32_t worldX, int32_t worldY, int32_t worldZ);
  TerrainDamageResult ApplyTileDamage(int32_t worldX, int32_t worldY, int32_t worldZ, int32_t damage);
  std::vector<uint16_t> BuildResolvedChunkTiles(int32_t cx, int32_t cy, int32_t cz) const;
  std::vector<std::tuple<int32_t, int32_t, int32_t>> ConsumeDirtyTerrainChunks();

  bool CheckTileCollision(const aabb::AABB &box, int32_t z, Point &resolution);
  bool CheckTileBlocked(const aabb::AABB &box, int32_t z);
  bool HasSupportAt(int32_t tileX, int32_t tileY, int32_t z) const;
  bool AllowsFallThroughAt(int32_t tileX, int32_t tileY, int32_t z) const;
  std::vector<std::tuple<int32_t, int32_t, int32_t>> GetLoadedChunkCoords() const;

private:
  static std::tuple<int32_t, int32_t, int32_t> WorldToChunkCoord(int32_t worldX, int32_t worldY, int32_t worldZ);
  static uint16_t WorldToLocalIndex(int32_t worldX, int32_t worldY, int32_t worldZ);
  void GenerateChunk(int32_t cx, int32_t cy, int32_t cz, Chunk *chunk);
  void UpdateTileVisuals(int32_t worldX, int32_t worldY, int32_t worldZ);
  uint16_t GetResolvedTileAtInternal(int32_t worldX, int32_t worldY, int32_t worldZ, uint16_t baseTileId) const;
  std::unordered_map<std::tuple<int32_t, int32_t, int32_t>, Chunk, ChunkCoordHash> chunks_;
  TerrainDestructionState terrain_;
};
