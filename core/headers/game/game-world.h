#pragma once
#include <unordered_map>
#include <string>
#include <memory>
#include <vector>
#include "game/game-object.h"
#include "game/world.h"
#include "math/number.h"

struct EntityRecord
{
  std::unique_ptr<GameObject> Object;
  unsigned int PhysicsId;
  float32 Radius;
};

class GameWorld
{
public:
  std::unique_ptr<WorldManager> ChunkManager;
  std::unordered_map<std::string, EntityRecord> Players;
  std::unordered_map<std::string, EntityRecord> Props;

  std::vector<std::string> RecentlyDestroyed;

  GameWorld();

  Chunk *GetChunkSafely(int32_t cx, int32_t cy, int32_t cz);
};