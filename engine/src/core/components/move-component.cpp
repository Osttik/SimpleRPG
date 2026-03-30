#include "core/components/move-component.h"
#include "core/game-world-engine.h"

void MoveComponentManager::AddComponentTo(GameObject *obj)
{
  ComponentManager::AddComponentTo(obj);
  obj->AddComponent<MoveComponent>(obj);  // pass owner explicitly
}

void MoveComponent::Move(float32 dx, float32 dy)
{
  auto prevPos = Owner->Transform.Position();
  auto dPoint = Point(dx * SPEED, dy * SPEED, prevPos.Z);
  Owner->Transform.SetPosition(PointOperations::Add(prevPos, dPoint));

  if (dx != float32(0) || dy != float32(0))
  {
    Owner->Transform.SetFacing(dPoint);
  }

  Owner->BoundingBox.get()->MoveBy(dPoint);

  // Keep AABB tree in sync after position change
  Owner->Context->Physics.UpdateObject(Owner->PhysicsId);
}
