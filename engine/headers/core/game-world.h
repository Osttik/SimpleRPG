#pragma once
#include <memory>
#include "core/world.h"
#include "core/chunk.h"

class GameWorld {
public:
    std::unique_ptr<WorldManager> ChunkManager;

    GameWorld();

    Chunk* GetChunkSafely(int32_t cx, int32_t cy, int32_t cz);
};