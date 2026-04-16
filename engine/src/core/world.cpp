#include <algorithm>
#include "core/world.h"
#include "core/constants.h"
#include "core/tile-registry.h"

namespace
{
constexpr uint16_t TILE_AIR = 0;
constexpr uint16_t TILE_GRASS = 1;
constexpr uint16_t TILE_STONE_WALL = 2;
constexpr uint16_t TILE_DARK_GRASS = 3;
constexpr uint16_t TILE_STAIRS_UP = 6;
constexpr uint16_t TILE_STAIRS_DOWN = 7;
constexpr uint16_t TILE_DROP_DOWN = 9;
constexpr uint16_t TILE_TEMPORARY_ROOF = 10;
constexpr uint16_t TILE_GRASS_DAMAGED_1 = 11;
constexpr uint16_t TILE_GRASS_DAMAGED_2 = 12;
constexpr uint16_t TILE_STONE_FLOOR = 13;
constexpr uint16_t TILE_STONE_FLOOR_DAMAGED_1 = 14;
constexpr uint16_t TILE_STONE_FLOOR_DAMAGED_2 = 15;
constexpr uint16_t TILE_GOLD_ORE = 16;
constexpr uint16_t TILE_GOLD_ORE_DAMAGED_1 = 17;
constexpr uint16_t TILE_GOLD_ORE_DAMAGED_2 = 18;

int32_t FloorDivInt(int32_t value, int32_t divisor)
{
    int32_t quotient = value / divisor;
    int32_t remainder = value % divisor;
    if (remainder != 0 && ((remainder < 0) != (divisor < 0)))
        --quotient;
    return quotient;
}

int32_t PositiveModulo(int32_t value, int32_t divisor)
{
    int32_t result = value % divisor;
    return result < 0 ? result + divisor : result;
}

int32_t FloorFixedByTileSize(float32 value)
{
    const int64_t raw = static_cast<int64_t>(value.raw_value());
    const int64_t divisor = static_cast<int64_t>(TILE_SIZE.raw_value());
    int64_t quotient = raw / divisor;
    const int64_t remainder = raw % divisor;
    if (remainder != 0 && raw < 0)
        --quotient;
    return static_cast<int32_t>(quotient);
}
}

WorldManager::WorldManager() {}

std::tuple<int32_t, int32_t, int32_t> WorldManager::WorldToChunkCoord(int32_t worldX, int32_t worldY, int32_t worldZ)
{
    return std::make_tuple(
        FloorDivInt(worldX, CHUNK_SIZE),
        FloorDivInt(worldY, CHUNK_SIZE),
        FloorDivInt(worldZ, CHUNK_SIZE));
}

uint16_t WorldManager::WorldToLocalIndex(int32_t worldX, int32_t worldY, int32_t worldZ)
{
    const int32_t lx = PositiveModulo(worldX, CHUNK_SIZE);
    const int32_t ly = PositiveModulo(worldY, CHUNK_SIZE);
    const int32_t lz = PositiveModulo(worldZ, CHUNK_SIZE);
    return static_cast<uint16_t>(lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE);
}

Chunk* WorldManager::GetChunk(int32_t cx, int32_t cy, int32_t cz) {
  auto coord = std::make_tuple(cx, cy, cz);
  auto it = chunks_.find(coord);
  
  if (it != chunks_.end()) {
    return &it->second;
  }
  
  Chunk& newChunk = chunks_[coord];
  GenerateChunk(cx, cy, cz, &newChunk);
  
  // Calculate visuals for the new chunk
  for (int x = 0; x < CHUNK_SIZE; ++x) {
    for (int y = 0; y < CHUNK_SIZE; ++y) {
      for (int z = 0; z < CHUNK_SIZE; ++z) {
        UpdateTileVisuals(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y, cz * CHUNK_SIZE + z);
      }
    }
  }

  // Also update neighbors on the boundary to fix seams
  for (int x = -1; x <= CHUNK_SIZE; ++x) {
    for (int y = -1; y <= CHUNK_SIZE; ++y) {
      if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE) continue;
      for (int z = 0; z < CHUNK_SIZE; ++z) {
        UpdateTileVisuals(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y, cz * CHUNK_SIZE + z);
      }
    }
  }

  return &newChunk;
}

uint16_t WorldManager::GetBaseTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) const {
    auto coord = WorldToChunkCoord(worldX, worldY, worldZ);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) {
        return 0;
    }

    const uint16_t index = WorldToLocalIndex(worldX, worldY, worldZ);
    return it->second.tiles[index];
}

uint16_t WorldManager::GetResolvedTileAtInternal(int32_t worldX, int32_t worldY, int32_t worldZ, uint16_t baseTileId) const
{
    const auto [cx, cy, cz] = WorldToChunkCoord(worldX, worldY, worldZ);
    const uint16_t localIndex = WorldToLocalIndex(worldX, worldY, worldZ);
    return terrain_.ResolveTileId(cx, cy, cz, localIndex, baseTileId, TileRegistry::GetTileDestruction(baseTileId));
}

uint16_t WorldManager::GetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) const {
    const uint16_t baseTileId = GetBaseTileAt(worldX, worldY, worldZ);
    return GetResolvedTileAtInternal(worldX, worldY, worldZ, baseTileId);
}

void WorldManager::SetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ, uint16_t tileId)
{
    const auto [cx, cy, cz] = WorldToChunkCoord(worldX, worldY, worldZ);
    Chunk *chunk = GetChunk(cx, cy, cz);
    if (!chunk)
        return;

    const uint16_t index = WorldToLocalIndex(worldX, worldY, worldZ);
    chunk->tiles[index] = tileId;
    terrain_.ClearOverride(cx, cy, cz, index);
    NotifyTileChanged(worldX, worldY, worldZ);
}

void WorldManager::UpdateTileVisuals(int32_t worldX, int32_t worldY, int32_t worldZ) {
    auto coord = WorldToChunkCoord(worldX, worldY, worldZ);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) return;

    const uint16_t index = WorldToLocalIndex(worldX, worldY, worldZ);
    uint16_t centerTile = GetResolvedTileAtInternal(worldX, worldY, worldZ, it->second.tiles[index]);

    if (centerTile == 0) {
        it->second.visual_mask_layer[index] = 0;
        return;
    }

    bool n  = (GetTileAt(worldX, worldY - 1, worldZ) == centerTile);
    bool ne = (GetTileAt(worldX + 1, worldY - 1, worldZ) == centerTile);
    bool e  = (GetTileAt(worldX + 1, worldY, worldZ) == centerTile);
    bool se = (GetTileAt(worldX + 1, worldY + 1, worldZ) == centerTile);
    bool s  = (GetTileAt(worldX, worldY + 1, worldZ) == centerTile);
    bool sw = (GetTileAt(worldX - 1, worldY + 1, worldZ) == centerTile);
    bool w  = (GetTileAt(worldX - 1, worldY, worldZ) == centerTile);
    bool nw = (GetTileAt(worldX - 1, worldY - 1, worldZ) == centerTile);

    // Corner checking
    if (!n) { nw = false; ne = false; }
    if (!e) { ne = false; se = false; }
    if (!s) { se = false; sw = false; }
    if (!w) { nw = false; sw = false; }

    uint8_t mask = 0;
    if (n)  mask |= 1;
    if (ne) mask |= 2;
    if (e)  mask |= 4;
    if (se) mask |= 8;
    if (s)  mask |= 16;
    if (sw) mask |= 32;
    if (w)  mask |= 64;
    if (nw) mask |= 128;

    it->second.visual_mask_layer[index] = mask;
}

void WorldManager::NotifyTileChanged(int32_t worldX, int32_t worldY, int32_t worldZ) {
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            const int32_t sampleX = worldX + dx;
            const int32_t sampleY = worldY + dy;
            UpdateTileVisuals(sampleX, sampleY, worldZ);
            const auto dirtyCoord = WorldToChunkCoord(sampleX, sampleY, worldZ);
            terrain_.MarkChunkDirty(std::get<0>(dirtyCoord), std::get<1>(dirtyCoord), std::get<2>(dirtyCoord));
        }
    }
}

TerrainDamageResult WorldManager::ApplyTileDamage(int32_t worldX, int32_t worldY, int32_t worldZ, int32_t damage)
{
    const uint16_t baseTileId = GetBaseTileAt(worldX, worldY, worldZ);
    const auto [cx, cy, cz] = WorldToChunkCoord(worldX, worldY, worldZ);
    const uint16_t localIndex = WorldToLocalIndex(worldX, worldY, worldZ);

    TerrainDamageResult result = terrain_.ApplyDamage(
        cx,
        cy,
        cz,
        localIndex,
        baseTileId,
        TileRegistry::GetTileDestruction(baseTileId),
        damage);

    if (result.VisualChanged)
        NotifyTileChanged(worldX, worldY, worldZ);
    return result;
}

std::vector<uint16_t> WorldManager::BuildResolvedChunkTiles(int32_t cx, int32_t cy, int32_t cz) const
{
    auto it = chunks_.find(std::make_tuple(cx, cy, cz));
    if (it == chunks_.end())
        return {};

    std::vector<uint16_t> out(CHUNK_VOLUME);
    for (int lz = 0; lz < CHUNK_SIZE; ++lz)
    {
        for (int ly = 0; ly < CHUNK_SIZE; ++ly)
        {
            for (int lx = 0; lx < CHUNK_SIZE; ++lx)
            {
                const int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
                const int32_t worldX = cx * CHUNK_SIZE + lx;
                const int32_t worldY = cy * CHUNK_SIZE + ly;
                const int32_t worldZ = cz * CHUNK_SIZE + lz;
                out[index] = GetResolvedTileAtInternal(worldX, worldY, worldZ, it->second.tiles[index]);
            }
        }
    }
    return out;
}

std::vector<std::tuple<int32_t, int32_t, int32_t>> WorldManager::ConsumeDirtyTerrainChunks()
{
    return terrain_.ConsumeDirtyChunks();
}

void WorldManager::GenerateChunk(int32_t cx, int32_t cy, int32_t cz, Chunk* chunk) {
  // Simple procedural generation for testing
  for (int x = 0; x < CHUNK_SIZE; ++x) {
    for (int y = 0; y < CHUNK_SIZE; ++y) {
      for (int z = 0; z < CHUNK_SIZE; ++z) {
        int index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        
        if (cz < 0) {
          // Underground layers are standable terrain so destroying support above can land on them.
          chunk->tiles[index] = TILE_STONE_FLOOR;
        } else if (cz == 0) {
          if (z == 0) {
            // Surface floor: grass
            chunk->tiles[index] = TILE_GRASS;
          } else if (z == 1 && cx == 0 && cy == 0 && x >= 5 && x <= 10 && y >= 5 && y <= 10) {
            // Small upper test floor for layered rendering and stairs validation.
            chunk->tiles[index] = TILE_DARK_GRASS;
          } else if (z == 2 && cx == 0 && cy == 0 && x >= 5 && x <= 10 && y >= 5 && y <= 10) {
            // Temporary roof/ceiling plane over the test floor; client fade keeps the player readable.
            chunk->tiles[index] = TILE_TEMPORARY_ROOF;
          } else if (z == 1 && (x == 0 || y == 0 || x == CHUNK_SIZE - 1 || y == CHUNK_SIZE - 1)) {
            // Put walls on the borders of chunks at z=1, except at some gates
            if (x != CHUNK_SIZE / 2 && y != CHUNK_SIZE / 2) {
              chunk->tiles[index] = TILE_STONE_WALL;
            } else {
              chunk->tiles[index] = TILE_AIR;
            }
          } else {
             // Air
             chunk->tiles[index] = TILE_AIR;
          }
        } else {
          // Air
          chunk->tiles[index] = TILE_AIR;
        }
      }
    }
  }

  if (cz == 0 && cx == 0 && cy == 0)
  {
    chunk->tiles[4 + 7 * CHUNK_SIZE + 0 * CHUNK_SIZE * CHUNK_SIZE] = TILE_STAIRS_UP;
    chunk->tiles[4 + 7 * CHUNK_SIZE + 1 * CHUNK_SIZE * CHUNK_SIZE] = TILE_STAIRS_DOWN;
    chunk->tiles[7 + 10 * CHUNK_SIZE + 1 * CHUNK_SIZE * CHUNK_SIZE] = TILE_DROP_DOWN;
  }

  if (cz == -1 && cx == 0 && cy == 0)
  {
    for (int x = 6; x <= 8; ++x)
    {
      for (int y = 6; y <= 8; ++y)
      {
        const int topLayerIndex = x + y * CHUNK_SIZE + (CHUNK_SIZE - 1) * CHUNK_SIZE * CHUNK_SIZE;
        chunk->tiles[topLayerIndex] = TILE_GOLD_ORE;
      }
    }
  }
}

bool WorldManager::CheckTileCollision(const aabb::AABB& box, int32_t z, Point& resolution) {
    bool collided = false;
    resolution = Point(float32(0), float32(0));

    float32 maxPushX = float32(0);
    float32 minPushX = float32(0);
    float32 maxPushY = float32(0);
    float32 minPushY = float32(0);

    // Convert world coordinates to tile indices
    int32_t minX = FloorFixedByTileSize(box.lowerBound[0]);
    int32_t minY = FloorFixedByTileSize(box.lowerBound[1]);
    int32_t maxX = FloorFixedByTileSize(box.upperBound[0]);
    int32_t maxY = FloorFixedByTileSize(box.upperBound[1]);

    for (int32_t tx = minX; tx <= maxX; ++tx) {
        for (int32_t ty = minY; ty <= maxY; ++ty) {
            uint16_t tileId = GetTileAt(tx, ty, z);
            if (tileId != 0 && TileRegistry::GetTileCollide(tileId)) {
                collided = true;
                
                // Calculate tile AABB
                float32 tileLeft = float32(tx) * TILE_SIZE;
                float32 tileTop = float32(ty) * TILE_SIZE;
                float32 tileRight = tileLeft + TILE_SIZE;
                float32 tileBottom = tileTop + TILE_SIZE;

                float32 boxLeft = box.lowerBound[0];
                float32 boxRight = box.upperBound[0];
                float32 boxTop = box.lowerBound[1];
                float32 boxBottom = box.upperBound[1];

                float32 dx1 = tileRight - boxLeft;
                float32 dx2 = boxRight - tileLeft;
                float32 dy1 = tileBottom - boxTop;
                float32 dy2 = boxBottom - tileTop;

                // Find minimum overlap direction
                float32 absDx1 = dx1 < float32(0) ? float32(0) - dx1 : dx1;
                float32 absDx2 = dx2 < float32(0) ? float32(0) - dx2 : dx2;
                float32 absDy1 = dy1 < float32(0) ? float32(0) - dy1 : dy1;
                float32 absDy2 = dy2 < float32(0) ? float32(0) - dy2 : dy2;

                float32 minOverlap = absDx1;
                Point res(dx1, float32(0));

                if (absDx2 < minOverlap) {
                    minOverlap = absDx2;
                    res = Point(float32(0) - absDx2, float32(0));
                }
                if (absDy1 < minOverlap) {
                    minOverlap = absDy1;
                    res = Point(float32(0), dy1);
                }
                if (absDy2 < minOverlap) {
                    minOverlap = absDy2;
                    res = Point(float32(0), float32(0) - absDy2);
                }

                if (res.X > maxPushX) maxPushX = res.X;
                if (res.X < minPushX) minPushX = res.X;
                if (res.Y > maxPushY) maxPushY = res.Y;
                if (res.Y < minPushY) minPushY = res.Y;
            }
        }
    }

    resolution.X = maxPushX + minPushX;
    resolution.Y = maxPushY + minPushY;

    return collided;
}

bool WorldManager::CheckTileBlocked(const aabb::AABB &box, int32_t z)
{
    Point resolution;
    return CheckTileCollision(box, z, resolution);
}

bool WorldManager::HasSupportAt(int32_t tileX, int32_t tileY, int32_t z) const
{
    return TileRegistry::GetTileSupport(GetTileAt(tileX, tileY, z));
}

bool WorldManager::AllowsFallThroughAt(int32_t tileX, int32_t tileY, int32_t z) const
{
    return TileRegistry::GetTileFallThrough(GetTileAt(tileX, tileY, z));
}

std::vector<std::tuple<int32_t, int32_t, int32_t>> WorldManager::GetLoadedChunkCoords() const
{
    std::vector<std::tuple<int32_t, int32_t, int32_t>> coords;
    coords.reserve(chunks_.size());
    for (const auto &[coord, chunk] : chunks_)
    {
        (void)chunk;
        coords.push_back(coord);
    }
    std::sort(coords.begin(), coords.end());
    return coords;
}

void WorldManager::RebuildChunkVisuals(int32_t cx, int32_t cy, int32_t cz)
{
    auto it = chunks_.find(std::make_tuple(cx, cy, cz));
    if (it == chunks_.end())
        return;

    for (int x = 0; x < CHUNK_SIZE; ++x)
    {
        for (int y = 0; y < CHUNK_SIZE; ++y)
        {
            for (int z = 0; z < CHUNK_SIZE; ++z)
            {
                UpdateTileVisuals(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y, cz * CHUNK_SIZE + z);
            }
        }
    }

    for (int x = -1; x <= CHUNK_SIZE; ++x)
    {
        for (int y = -1; y <= CHUNK_SIZE; ++y)
        {
            if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE)
                continue;

            for (int z = 0; z < CHUNK_SIZE; ++z)
            {
                UpdateTileVisuals(cx * CHUNK_SIZE + x, cy * CHUNK_SIZE + y, cz * CHUNK_SIZE + z);
            }
        }
    }
}

std::vector<TerrainOverrideEntry> WorldManager::ExportTerrainOverrides() const
{
    return terrain_.ExportOverrides();
}

void WorldManager::ImportTerrainOverride(const TerrainOverrideEntry &entry)
{
    GetChunk(entry.ChunkX, entry.ChunkY, entry.ChunkZ);
    terrain_.ImportOverride(entry);
}

void WorldManager::ClearAllState()
{
    chunks_.clear();
    terrain_.ClearAll();
}
