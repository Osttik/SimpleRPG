#include <algorithm>
#include "core/world.h"
#include "core/constants.h"
#include "core/tile-registry.h"

namespace
{
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

uint16_t WorldManager::GetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) const {
    int32_t cx = FloorDivInt(worldX, CHUNK_SIZE);
    int32_t cy = FloorDivInt(worldY, CHUNK_SIZE);
    int32_t cz = FloorDivInt(worldZ, CHUNK_SIZE);

    auto coord = std::make_tuple(cx, cy, cz);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) {
        return 0;
    }

    int32_t lx = PositiveModulo(worldX, CHUNK_SIZE);
    int32_t ly = PositiveModulo(worldY, CHUNK_SIZE);
    int32_t lz = PositiveModulo(worldZ, CHUNK_SIZE);

    int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    return it->second.tiles[index];
}

void WorldManager::SetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ, uint16_t tileId)
{
    int32_t cx = FloorDivInt(worldX, CHUNK_SIZE);
    int32_t cy = FloorDivInt(worldY, CHUNK_SIZE);
    int32_t cz = FloorDivInt(worldZ, CHUNK_SIZE);
    Chunk *chunk = GetChunk(cx, cy, cz);
    if (!chunk)
        return;

    const int32_t lx = PositiveModulo(worldX, CHUNK_SIZE);
    const int32_t ly = PositiveModulo(worldY, CHUNK_SIZE);
    const int32_t lz = PositiveModulo(worldZ, CHUNK_SIZE);
    const int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    chunk->tiles[index] = tileId;
    NotifyTileChanged(worldX, worldY, worldZ);
}

void WorldManager::UpdateTileVisuals(int32_t worldX, int32_t worldY, int32_t worldZ) {
    int32_t cx = FloorDivInt(worldX, CHUNK_SIZE);
    int32_t cy = FloorDivInt(worldY, CHUNK_SIZE);
    int32_t cz = FloorDivInt(worldZ, CHUNK_SIZE);

    auto coord = std::make_tuple(cx, cy, cz);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) return;

    int32_t lx = PositiveModulo(worldX, CHUNK_SIZE);
    int32_t ly = PositiveModulo(worldY, CHUNK_SIZE);
    int32_t lz = PositiveModulo(worldZ, CHUNK_SIZE);

    int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    uint16_t centerTile = it->second.tiles[index];

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
            UpdateTileVisuals(worldX + dx, worldY + dy, worldZ);
        }
    }
}

void WorldManager::GenerateChunk(int32_t cx, int32_t cy, int32_t cz, Chunk* chunk) {
  // Simple procedural generation for testing
  for (int x = 0; x < CHUNK_SIZE; ++x) {
    for (int y = 0; y < CHUNK_SIZE; ++y) {
      for (int z = 0; z < CHUNK_SIZE; ++z) {
        int index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        
        if (cz < 0) {
          // Underground: solid stone
          chunk->tiles[index] = 2; // e.g. 2 = stone
        } else if (cz == 0) {
          if (z == 0) {
            // Surface floor: grass
            chunk->tiles[index] = 1; // e.g. 1 = grass
          } else if (z == 1 && cx == 0 && cy == 0 && x >= 5 && x <= 10 && y >= 5 && y <= 10) {
            // Small upper test floor for layered rendering and stairs validation.
            chunk->tiles[index] = 3;
          } else if (z == 2 && cx == 0 && cy == 0 && x >= 5 && x <= 10 && y >= 5 && y <= 10) {
            // Temporary roof/ceiling plane over the test floor; client fade keeps the player readable.
            chunk->tiles[index] = 10;
          } else if (z == 1 && (x == 0 || y == 0 || x == CHUNK_SIZE - 1 || y == CHUNK_SIZE - 1)) {
            // Put walls on the borders of chunks at z=1, except at some gates
            if (x != CHUNK_SIZE / 2 && y != CHUNK_SIZE / 2) {
              chunk->tiles[index] = 2; // Stone wall
            } else {
              chunk->tiles[index] = 0;
            }
          } else {
             // Air
             chunk->tiles[index] = 0;
          }
        } else {
          // Air
          chunk->tiles[index] = 0;
        }
      }
    }
  }

  if (cz == 0 && cx == 0 && cy == 0)
  {
    chunk->tiles[4 + 7 * CHUNK_SIZE + 0 * CHUNK_SIZE * CHUNK_SIZE] = 6;
    chunk->tiles[4 + 7 * CHUNK_SIZE + 1 * CHUNK_SIZE * CHUNK_SIZE] = 7;
    chunk->tiles[7 + 10 * CHUNK_SIZE + 1 * CHUNK_SIZE * CHUNK_SIZE] = 9;
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
    int32_t cx = FloorDivInt(tileX, CHUNK_SIZE);
    int32_t cy = FloorDivInt(tileY, CHUNK_SIZE);
    int32_t cz = FloorDivInt(z, CHUNK_SIZE);
    auto it = chunks_.find(std::make_tuple(cx, cy, cz));
    if (it == chunks_.end())
        return false;

    const int32_t lx = PositiveModulo(tileX, CHUNK_SIZE);
    const int32_t ly = PositiveModulo(tileY, CHUNK_SIZE);
    const int32_t lz = PositiveModulo(z, CHUNK_SIZE);
    const int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    return TileRegistry::GetTileSupport(it->second.tiles[index]);
}

bool WorldManager::AllowsFallThroughAt(int32_t tileX, int32_t tileY, int32_t z) const
{
    int32_t cx = FloorDivInt(tileX, CHUNK_SIZE);
    int32_t cy = FloorDivInt(tileY, CHUNK_SIZE);
    int32_t cz = FloorDivInt(z, CHUNK_SIZE);
    auto it = chunks_.find(std::make_tuple(cx, cy, cz));
    if (it == chunks_.end())
        return true;

    const int32_t lx = PositiveModulo(tileX, CHUNK_SIZE);
    const int32_t ly = PositiveModulo(tileY, CHUNK_SIZE);
    const int32_t lz = PositiveModulo(z, CHUNK_SIZE);
    const int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    return TileRegistry::GetTileFallThrough(it->second.tiles[index]);
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
