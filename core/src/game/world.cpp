#include <cmath>
#include <algorithm>
#include "game/world.h"
#include "game/constants.h"
#include "game/tile-registry.h"

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

uint16_t WorldManager::GetTileAt(int32_t worldX, int32_t worldY, int32_t worldZ) {
    int32_t cx = static_cast<int32_t>(std::floor(static_cast<double>(worldX) / CHUNK_SIZE));
    int32_t cy = static_cast<int32_t>(std::floor(static_cast<double>(worldY) / CHUNK_SIZE));
    int32_t cz = static_cast<int32_t>(std::floor(static_cast<double>(worldZ) / CHUNK_SIZE));

    auto coord = std::make_tuple(cx, cy, cz);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) {
        return 0;
    }

    int32_t lx = worldX - cx * CHUNK_SIZE;
    int32_t ly = worldY - cy * CHUNK_SIZE;
    int32_t lz = worldZ - cz * CHUNK_SIZE;

    int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    return it->second.tiles[index];
}

void WorldManager::UpdateTileVisuals(int32_t worldX, int32_t worldY, int32_t worldZ) {
    int32_t cx = static_cast<int32_t>(std::floor(static_cast<double>(worldX) / CHUNK_SIZE));
    int32_t cy = static_cast<int32_t>(std::floor(static_cast<double>(worldY) / CHUNK_SIZE));
    int32_t cz = static_cast<int32_t>(std::floor(static_cast<double>(worldZ) / CHUNK_SIZE));

    auto coord = std::make_tuple(cx, cy, cz);
    auto it = chunks_.find(coord);
    if (it == chunks_.end()) return;

    int32_t lx = worldX - cx * CHUNK_SIZE;
    int32_t ly = worldY - cy * CHUNK_SIZE;
    int32_t lz = worldZ - cz * CHUNK_SIZE;

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
}

bool WorldManager::CheckTileCollision(const aabb::AABB& box, int32_t z, Point& resolution) {
    bool collided = false;
    resolution = Point(float32(0), float32(0));

    // Convert world coordinates to tile indices
    int32_t minX = static_cast<int32_t>(std::floor(static_cast<double>(box.lowerBound[0]) / static_cast<double>(TILE_SIZE)));
    int32_t minY = static_cast<int32_t>(std::floor(static_cast<double>(box.lowerBound[1]) / static_cast<double>(TILE_SIZE)));
    int32_t maxX = static_cast<int32_t>(std::floor(static_cast<double>(box.upperBound[0]) / static_cast<double>(TILE_SIZE)));
    int32_t maxY = static_cast<int32_t>(std::floor(static_cast<double>(box.upperBound[1]) / static_cast<double>(TILE_SIZE)));

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
                float32 dy2 = boxBottom - boxTop;

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

                resolution.X += res.X;
                resolution.Y += res.Y;
            }
        }
    }

    return collided;
}
