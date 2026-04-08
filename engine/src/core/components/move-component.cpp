#include "core/components/move-component.h"
#include "core/game-object/game-object.h"

void MoveComponentManager::Move(uint32_t entityId, float32 dx, float32 dy)
{
  auto *comp = Get(entityId);
  if (!comp || !comp->Owner)
    return;

  GameObject *obj = comp->Owner;
  auto prevPos = obj->Transform.Position();
  auto dPoint = Point(dx * comp->Speed, dy * comp->Speed, prevPos.Z);
  obj->Transform.SetPosition(PointOperations::Add(prevPos, dPoint));

  if (dx != float32(0) || dy != float32(0))
  {
    obj->Transform.SetFacing(dPoint);
  }
}
