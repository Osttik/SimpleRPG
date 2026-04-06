#include "game/managers/player-manager.h"
#include "game/entities/player-builder.h"

uint32_t PlayerManager::AddPlayer(GameWorldEngine &manager, const Point &position)
{
  return PlayerBuilder::Build(manager, position);
}

void PlayerManager::RemovePlayer(uint32_t playerId)
{
}