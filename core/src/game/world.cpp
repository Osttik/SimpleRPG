#include "game/world.h"

WorldManager::WorldManager() {}

Chunk* WorldManager::GetChunk(int32_t cx, int32_t cy, int32_t cz) {
  auto coord = std::make_tuple(cx, cy, cz);
  auto it = chunks_.find(coord);
  
  if (it != chunks_.end()) {
    return &it->second;
  }
  
  Chunk& newChunk = chunks_[coord];
  GenerateChunk(cx, cy, cz, &newChunk);
  return &newChunk;
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
