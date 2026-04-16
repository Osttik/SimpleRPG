#pragma once
#include <array>
#include <cstdint>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include "core/chunk.h"

struct TerrainChunkCoordHash
{
  std::size_t operator()(const std::tuple<int32_t, int32_t, int32_t> &k) const
  {
    auto [x, y, z] = k;
    return std::hash<int32_t>{}(x) ^ (std::hash<int32_t>{}(y) << 1) ^ (std::hash<int32_t>{}(z) << 2);
  }
};

struct TileDestructionDef;

struct TerrainStageRewardGrant
{
  std::string ItemDefinitionId;
  uint16_t Quantity = 0;
};

struct TerrainDamageResult
{
  bool StateChanged = false;
  bool VisualChanged = false;
  bool Destroyed = false;
  uint8_t PreviousStage = 0;
  uint8_t CurrentStage = 0;
  int32_t PreviousDamage = 0;
  int32_t CurrentDamage = 0;
  uint16_t ResolvedTileId = 0;
  std::vector<TerrainStageRewardGrant> Rewards;
};

struct ModifiedTerrainTileState
{
  int32_t Damage = 0;
  uint8_t Stage = 0;
  uint32_t GrantedStageMask = 0;
  uint16_t OverrideTileId = 0;
  bool Destroyed = false;
};

struct TerrainChunkOverrides
{
  std::unordered_map<uint16_t, ModifiedTerrainTileState> Tiles;
};

struct TerrainOverrideEntry
{
  int32_t ChunkX = 0;
  int32_t ChunkY = 0;
  int32_t ChunkZ = 0;
  uint16_t LocalIndex = 0;
  ModifiedTerrainTileState State;
};

class TerrainDestructionState
{
public:
  uint16_t ResolveTileId(
      int32_t cx,
      int32_t cy,
      int32_t cz,
      uint16_t localIndex,
      uint16_t baseTileId,
      const TileDestructionDef *destruction) const;

  TerrainDamageResult ApplyDamage(
      int32_t cx,
      int32_t cy,
      int32_t cz,
      uint16_t localIndex,
      uint16_t baseTileId,
      const TileDestructionDef *destruction,
      int32_t damage);

  void ClearOverride(int32_t cx, int32_t cy, int32_t cz, uint16_t localIndex);
  void MarkChunkDirty(int32_t cx, int32_t cy, int32_t cz);
  std::vector<std::tuple<int32_t, int32_t, int32_t>> ConsumeDirtyChunks();
  std::vector<TerrainOverrideEntry> ExportOverrides() const;
  void ImportOverride(const TerrainOverrideEntry &entry);
  void ClearAll();

private:
  TerrainChunkOverrides &EnsureChunk(int32_t cx, int32_t cy, int32_t cz);
  const TerrainChunkOverrides *FindChunk(int32_t cx, int32_t cy, int32_t cz) const;

  std::unordered_map<std::tuple<int32_t, int32_t, int32_t>, TerrainChunkOverrides, TerrainChunkCoordHash> _overrides;
  std::unordered_set<std::tuple<int32_t, int32_t, int32_t>, TerrainChunkCoordHash> _dirtyChunks;
};
