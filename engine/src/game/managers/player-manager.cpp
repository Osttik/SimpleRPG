#include "game/managers/player-manager.h"
#include "game/entities/player-builder.h"

uint32_t PlayerManager::AddPlayer(GameWorldEngine &engine, const Point &position)
{
  return PlayerBuilder::Build(engine, position);
}

void PlayerManager::RemovePlayer(GameWorldEngine &engine, uint32_t playerId)
{
  engine.ObjectManager.MarkForDestruction(playerId);
}
