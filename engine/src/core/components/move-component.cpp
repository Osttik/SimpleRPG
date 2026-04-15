#include "core/components/move-component.h"
#include "core/components/combat-body-component.h"
#include "core/game-object/game-object.h"
#include "core/game-world-engine.h"

void MoveComponentManager::Move(uint32_t entityId, float32 dx, float32 dy)
{
  auto *comp = Get(entityId);
  if (!comp || !comp->Owner)
    return;

  GameObject *obj = comp->Owner;
  comp->LastInputX = dx;
  comp->LastInputY = dy;

  auto prevPos = obj->Transform.Position();
  float32 speedScale = float32(1);
  if (obj->Context)
  {
    auto *combatBodyMgr = obj->Context->Ctx.GetManager<CombatBodyComponentManager>();
    if (combatBodyMgr)
    {
      speedScale = combatBodyMgr->GetMovementSpeedMultiplier(entityId);
    }
  }

  auto dPoint = Point(dx * comp->Speed * speedScale, dy * comp->Speed * speedScale, prevPos.Z);
  obj->Transform.SetPosition(PointOperations::Add(prevPos, dPoint));

  if (dx != float32(0) || dy != float32(0))
  {
    obj->Transform.SetFacing(dPoint);
  }
}
