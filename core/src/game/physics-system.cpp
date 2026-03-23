#include "game/physics-system.h"
#include "math/point.h"

PhysicsSystem::PhysicsSystem()
{
  _aabbTree = std::make_unique<GameObjectPhysics>();
}

unsigned int PhysicsSystem::AddObject(GameObject *obj)
{
  return _aabbTree->AddObject(obj);
}

void PhysicsSystem::UpdateObject(unsigned int physicsId)
{
  _aabbTree->UpdateObject(physicsId);
}

void PhysicsSystem::RemoveObject(unsigned int physicsId)
{
  _aabbTree->RemoveObject(physicsId);
}

void PhysicsSystem::Tick(GameWorld &world)
{
  _aabbTree->Tick(world.ChunkManager.get());
}

void PhysicsSystem::ResolveCircleCollision(GameObject *objA, GameObject *objB)
{
  Circle *circleA = dynamic_cast<Circle *>(const_cast<Shape *>(objA->BoundingBox.get()));
  Circle *circleB = dynamic_cast<Circle *>(const_cast<Shape *>(objB->BoundingBox.get()));

  if (!circleA || !circleB)
    return;

  float32 dx = circleB->Center.X - circleA->Center.X;
  float32 dy = circleB->Center.Y - circleA->Center.Y;
  float32 minDist = circleA->Radius + circleB->Radius;

  float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
  float32 absDy = dy < float32(0) ? float32(0) - dy : dy;
  if (absDx > minDist || absDy > minDist)
    return;

  float32 distSquared = dx * dx + dy * dy;
  float32 dist = fpm::sqrt(distSquared);

  if (dist == float32(0))
    dist = float32(0.0001);

  float32 normalX = dx / dist;
  float32 normalY = dy / dist;
  float32 overlap = minDist - dist;
  float32 pushDistance = overlap / float32(2);

  objA->Transform.Position = Point(circleA->Center.X - normalX * pushDistance, circleA->Center.Y - normalY * pushDistance);
  objB->Transform.Position = Point(circleB->Center.X + normalX * pushDistance, circleB->Center.Y + normalY * pushDistance);

  circleA->Center = objA->Transform.Position;
  circleB->Center = objB->Transform.Position;
}

void PhysicsSystem::UpdateFocus(GameObject *source, const Point &mousePosition)
{
  if (!source)
    return;

  source->FocusedObjectId = 0; // reset

  float32 reachLimit(80); // roughly 2 tiles
  Point topleft(source->Transform.Position.X - reachLimit, source->Transform.Position.Y - reachLimit);
  Point bottomright(source->Transform.Position.X + reachLimit, source->Transform.Position.Y + reachLimit);

  auto candidates = _aabbTree->GetObjectsInArea(topleft, bottomright);

  GameObject *bestTarget = nullptr;
  float32 bestScore(-1000000);
  float32 bestMouseDist(1000000);
  GameObject *mouseTarget = nullptr;

  for (GameObject *obj : candidates)
  {
    if (obj == source)
      continue;
    if (!obj->Interaction)
      continue; // Must be interactable

    float32 dx = obj->Transform.Position.X - source->Transform.Position.X;
    float32 dy = obj->Transform.Position.Y - source->Transform.Position.Y;
    float32 distSq = dx * dx + dy * dy;

    if (distSq > reachLimit * reachLimit)
      continue;

    float32 dist = fpm::sqrt(distSq);
    if (dist == float32(0))
      dist = float32(0.0001);

    // Mouse Focus: Object under mouse
    float32 mdx = obj->Transform.Position.X - mousePosition.X;
    float32 mdy = obj->Transform.Position.Y - mousePosition.Y;
    float32 mDistSq = mdx * mdx + mdy * mdy;

    Circle *circle = dynamic_cast<Circle *>(const_cast<Shape *>(obj->BoundingBox.get()));
    float32 radius = circle ? circle->Radius : float32(20);
    float32 minMouseDistSq = radius * radius;

    // Be slightly forgiving for mouse hover
    if (mDistSq <= minMouseDistSq * float32(1.5))
    {
      if (mDistSq < bestMouseDist)
      {
        bestMouseDist = mDistSq;
        mouseTarget = obj;
      }
    }

    // Keyboard Focus score = Distance only
    float32 distanceScore = reachLimit - dist;
    float32 score = distanceScore;

    if (score > bestScore)
    {
      bestScore = score;
      bestTarget = obj;
    }
  }

  if (mouseTarget)
  {
    source->FocusedObjectId = mouseTarget->PhysicsId;
  }
  else if (bestTarget)
  {
    source->FocusedObjectId = bestTarget->PhysicsId;
  }
}