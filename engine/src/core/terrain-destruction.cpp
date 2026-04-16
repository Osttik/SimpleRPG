#include <algorithm>
#include "core/terrain-destruction.h"
#include "core/tile-registry.h"
#include "core/world.h"

namespace
{
uint16_t ResolveStageTileId(const TileDestructionDef &destruction, uint8_t stage, uint16_t baseTileId)
{
  if (stage == 0)
    return baseTileId;

  const size_t index = static_cast<size_t>(stage - 1);
  if (index < destruction.StageVisualTileIds.size() && destruction.StageVisualTileIds[index] != 0)
    return destruction.StageVisualTileIds[index];
  return baseTileId;
}
}

TerrainChunkOverrides &TerrainDestructionState::EnsureChunk(int32_t cx, int32_t cy, int32_t cz)
{
  return _overrides[std::make_tuple(cx, cy, cz)];
}

const TerrainChunkOverrides *TerrainDestructionState::FindChunk(int32_t cx, int32_t cy, int32_t cz) const
{
  const auto it = _overrides.find(std::make_tuple(cx, cy, cz));
  return it != _overrides.end() ? &it->second : nullptr;
}

uint16_t TerrainDestructionState::ResolveTileId(
    int32_t cx,
    int32_t cy,
    int32_t cz,
    uint16_t localIndex,
    uint16_t baseTileId,
    const TileDestructionDef *destruction) const
{
  const TerrainChunkOverrides *chunk = FindChunk(cx, cy, cz);
  if (!chunk)
    return baseTileId;

  const auto tileIt = chunk->Tiles.find(localIndex);
  if (tileIt == chunk->Tiles.end())
    return baseTileId;

  const ModifiedTerrainTileState &state = tileIt->second;
  if (state.Destroyed)
    return state.OverrideTileId;

  if (state.OverrideTileId != 0)
    return state.OverrideTileId;

  if (!destruction)
    return baseTileId;

  return ResolveStageTileId(*destruction, state.Stage, baseTileId);
}

TerrainDamageResult TerrainDestructionState::ApplyDamage(
    int32_t cx,
    int32_t cy,
    int32_t cz,
    uint16_t localIndex,
    uint16_t baseTileId,
    const TileDestructionDef *destruction,
    int32_t damage)
{
  TerrainDamageResult result;
  result.ResolvedTileId = baseTileId;

  if (!destruction || !destruction->Destructible || damage <= 0 || destruction->MaxIntegrity <= 0)
    return result;

  TerrainChunkOverrides &chunk = EnsureChunk(cx, cy, cz);
  ModifiedTerrainTileState &state = chunk.Tiles[localIndex];

  result.PreviousStage = state.Stage;
  result.PreviousDamage = state.Damage;
  const uint16_t previousResolvedTileId = state.Destroyed
      ? state.OverrideTileId
      : (state.OverrideTileId != 0 ? state.OverrideTileId : ResolveStageTileId(*destruction, state.Stage, baseTileId));

  if (state.Destroyed)
  {
    result.CurrentStage = state.Stage;
    result.CurrentDamage = state.Damage;
    result.ResolvedTileId = state.OverrideTileId;
    return result;
  }

  state.Damage = std::min(destruction->MaxIntegrity, state.Damage + damage);

  uint8_t nextStage = 0;
  for (size_t i = 0; i < destruction->Stages.size(); ++i)
  {
    if (state.Damage >= destruction->Stages[i].Threshold)
      nextStage = static_cast<uint8_t>(i + 1);
  }

  for (size_t i = 0; i < destruction->Stages.size(); ++i)
  {
    const uint32_t stageBit = static_cast<uint32_t>(1u << i);
    if (state.Damage < destruction->Stages[i].Threshold || (state.GrantedStageMask & stageBit) != 0)
      continue;

    state.GrantedStageMask |= stageBit;
    for (const auto &loot : destruction->Stages[i].Loot)
    {
      if (loot.ItemDefinitionId.empty() || loot.Quantity == 0)
        continue;

      result.Rewards.push_back(TerrainStageRewardGrant{
          loot.ItemDefinitionId,
          loot.Quantity,
      });
    }
  }

  state.Stage = nextStage;
  if (state.Damage >= destruction->MaxIntegrity)
  {
    state.Destroyed = true;
    state.OverrideTileId = destruction->DestroyedTileId;
    result.Destroyed = true;
  }
  else
  {
    state.OverrideTileId = ResolveStageTileId(*destruction, state.Stage, baseTileId);
  }

  result.StateChanged = (state.Damage != result.PreviousDamage) || (state.Stage != result.PreviousStage);
  result.CurrentDamage = state.Damage;
  result.CurrentStage = state.Stage;
  result.ResolvedTileId = state.OverrideTileId != 0 || state.Destroyed ? state.OverrideTileId : baseTileId;
  result.VisualChanged = result.ResolvedTileId != previousResolvedTileId;

  if (!result.StateChanged && result.Rewards.empty())
    return result;

  if (result.VisualChanged)
    MarkChunkDirty(cx, cy, cz);
  return result;
}

void TerrainDestructionState::ClearOverride(int32_t cx, int32_t cy, int32_t cz, uint16_t localIndex)
{
  auto it = _overrides.find(std::make_tuple(cx, cy, cz));
  if (it == _overrides.end())
    return;

  it->second.Tiles.erase(localIndex);
  if (it->second.Tiles.empty())
    _overrides.erase(it);

  MarkChunkDirty(cx, cy, cz);
}

void TerrainDestructionState::MarkChunkDirty(int32_t cx, int32_t cy, int32_t cz)
{
  _dirtyChunks.insert(std::make_tuple(cx, cy, cz));
}

std::vector<std::tuple<int32_t, int32_t, int32_t>> TerrainDestructionState::ConsumeDirtyChunks()
{
  std::vector<std::tuple<int32_t, int32_t, int32_t>> coords;
  coords.reserve(_dirtyChunks.size());
  for (const auto &coord : _dirtyChunks)
    coords.push_back(coord);
  std::sort(coords.begin(), coords.end());
  _dirtyChunks.clear();
  return coords;
}
