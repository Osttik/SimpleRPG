#include "game/game-object-physics.h"
#include "game/world.h"
#include "math/rect.h"

void GameObjectPhysics::GetWorldBounds(GameObject* obj, std::vector<float32>& lower, std::vector<float32>& upper)
{
  Point topLeft = obj->BoundingBox->GetCornerPoint(CornerType::TopLeft);
  Point bottomRight = obj->BoundingBox->GetCornerPoint(CornerType::BottomRight);

  lower = {(std::min)(topLeft.X, bottomRight.X), (std::min)(topLeft.Y, bottomRight.Y)};
  upper = {(std::max)(topLeft.X, bottomRight.X), (std::max)(topLeft.Y, bottomRight.Y)};
}

unsigned int GameObjectPhysics::AddObject(GameObject* obj)
{
  unsigned int id = nextId++;
  objects[id] = obj;

  std::vector<float32> lower, upper;
  GetWorldBounds(obj, lower, upper);

  tree.insertParticle(id, lower, upper);
  return id;
}

void GameObjectPhysics::RemoveObject(unsigned int id)
{
  auto it = objects.find(id);
  if (it == objects.end())
    return;

  tree.removeParticle(id);
  objects.erase(it);
}

void GameObjectPhysics::UpdateObject(unsigned int id)
{
  if (objects.find(id) == objects.end())
    return;

  GameObject* obj = objects[id];
  std::vector<float32> lower, upper;
  GetWorldBounds(obj, lower, upper);

  tree.updateParticle(id, lower, upper);
}

void GameObjectPhysics::Tick(WorldManager* world)
{
  // 1. Update dynamic objects in the tree
  for (auto const& [id, obj] : objects)
  {
    if (!obj->IsStaticProp && !obj->IsPendingDestruction)
    {
      UpdateObject(id);
    }
  }

  // 2. Collision resolution
  for (auto const& [id, obj] : objects)
  {
    if (obj->IsPendingDestruction || obj->IsStaticProp)
      continue;

    // A. Query tree for entities
    std::vector<float32> lower, upper;
    GetWorldBounds(obj, lower, upper);
    aabb::AABB queryBox(lower, upper);
    std::vector<unsigned int> hits = tree.query(id, queryBox);

    for (unsigned int hitId : hits)
    {
      GameObject* other = objects[hitId];
      if (other->IsPendingDestruction)
        continue;
      if (other->ChunkZ != obj->ChunkZ)
        continue;

      // Circle-Circle Resolution
      Circle* circleA = dynamic_cast<Circle*>(obj->BoundingBox.get());
      Circle* circleB = dynamic_cast<Circle*>(other->BoundingBox.get());

      if (circleA && circleB)
      {
        float32 dx = circleB->Center.X - circleA->Center.X;
        float32 dy = circleB->Center.Y - circleA->Center.Y;
        float32 minDist = circleA->Radius + circleB->Radius;

        float32 distSquared = dx * dx + dy * dy;
        if (distSquared < minDist * minDist)
        {
          float32 dist = fpm::sqrt(distSquared);
          if (dist == float32(0))
            dist = float32(0.0001);

          float32 normalX = dx / dist;
          float32 normalY = dy / dist;
          float32 overlap = minDist - dist;
          float32 pushDistance = overlap / float32(2);

          // Only push the moving object if the other is static prop?
          // No, usually push both by half if both are dynamic.
          // If other is static prop, push obj by full overlap.
          if (other->IsStaticProp)
          {
            obj->Transform.Position.X -= normalX * overlap;
            obj->Transform.Position.Y -= normalY * overlap;
          }
          else
          {
            obj->Transform.Position.X -= normalX * pushDistance;
            obj->Transform.Position.Y -= normalY * pushDistance;
            other->Transform.Position.X += normalX * pushDistance;
            other->Transform.Position.Y += normalY * pushDistance;
            
            circleB->Center = other->Transform.Position;
          }
          circleA->Center = obj->Transform.Position;
        }
      }
    }

    // B. Grid Collision (Environment)
    Point resolution;
    // Re-check bounds after potential entity resolution
    GetWorldBounds(obj, lower, upper);
    aabb::AABB finalBox(lower, upper);
    if (world->CheckTileCollision(finalBox, obj->ChunkZ, resolution))
    {
      obj->Transform.Position.X += resolution.X;
      obj->Transform.Position.Y += resolution.Y;
      
      Circle* circle = dynamic_cast<Circle*>(obj->BoundingBox.get());
      if (circle) {
          circle->Center = obj->Transform.Position;
      }
    }
  }
}

std::vector<GameObject*> GameObjectPhysics::GetObjectsInArea(Point areaTopLeft, Point areaBottomRight)
{
  std::vector<float32> lower = {
      (std::min)(areaTopLeft.X, areaBottomRight.X),
      (std::min)(areaTopLeft.Y, areaBottomRight.Y)};
  std::vector<float32> upper = {
      (std::max)(areaTopLeft.X, areaBottomRight.X),
      (std::max)(areaTopLeft.Y, areaBottomRight.Y)};

  aabb::AABB queryBox(lower, upper);

  std::vector<unsigned int> hitIds = tree.query(queryBox);

  std::vector<GameObject*> hitObjects;
  for (unsigned int id : hitIds)
  {
    hitObjects.push_back(objects[id]);
  }

  return hitObjects;
}