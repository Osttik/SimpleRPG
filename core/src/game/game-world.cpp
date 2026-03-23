#include "game/game-world.h"

GameWorld::GameWorld()
{
  ChunkManager = std::make_unique<WorldManager>();
}

Chunk *GameWorld::GetChunkSafely(int32_t cx, int32_t cy, int32_t cz)
{
  return ChunkManager->GetChunk(cx, cy, cz);
}