#include "core/game-object/component-manager.h"
#include "core/game-object/game-object.h"

void ComponentManager::AddComponentTo(GameObject *obj)
{
  auto id = obj->Id;
  if (MembersIds.size() <= id)
  {
    MembersIds.resize(id + 1);
  }

  MembersIds[obj->Id]++;
}