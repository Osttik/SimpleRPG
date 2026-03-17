#include "game/game-object-physics.h"
#include "game/game-object.h"
#include "math/number.h"

void GameObjectPhysics::GetWorldBounds(GameObject *obj, std::vector<float32> &lower, std::vector<float32> &upper)
{
  Point localTopLeft = obj->BoundingBox->GetCornerPoint(CornerType::TopLeft);
  Point localBottomRight = obj->BoundingBox->GetCornerPoint(CornerType::BottomRight);

  float32 worldMinX = obj->Transform.Position.X + localTopLeft.X;
  float32 worldMaxX = obj->Transform.Position.X + localBottomRight.X;
  float32 worldMinY = obj->Transform.Position.Y + localTopLeft.Y;
  float32 worldMaxY = obj->Transform.Position.Y + localBottomRight.Y;

  lower = {std::min(worldMinX, worldMaxX), std::min(worldMinY, worldMaxY)};
  upper = {std::max(worldMinX, worldMaxX), std::max(worldMinY, worldMaxY)};
}

unsigned int GameObjectPhysics::AddObject(GameObject *obj)
{
  unsigned int id = nextId++;
  objects[id] = obj;

  std::vector<float32> lower, upper;
  GetWorldBounds(obj, lower, upper);

  tree.insertParticle(id, lower, upper);
  return id;
}

void GameObjectPhysics::UpdateObject(unsigned int id)
{
  if (objects.find(id) == objects.end())
    return;

  GameObject *obj = objects[id];
  std::vector<float32> lower, upper;
  GetWorldBounds(obj, lower, upper);

  tree.updateParticle(id, lower, upper);
}

std::vector<GameObject *> GameObjectPhysics::GetObjectsInArea(Point areaTopLeft, Point areaBottomRight)
{
  std::vector<float32> lower = {
      std::min(areaTopLeft.X, areaBottomRight.X),
      std::min(areaTopLeft.Y, areaBottomRight.Y)};
  std::vector<float32> upper = {
      std::max(areaTopLeft.X, areaBottomRight.X),
      std::max(areaTopLeft.Y, areaBottomRight.Y)};

  aabb::AABB queryBox(lower, upper);

  std::vector<unsigned int> hitIds = tree.query(queryBox);

  std::vector<GameObject *> hitObjects;
  for (unsigned int id : hitIds)
  {
    hitObjects.push_back(objects[id]);
  }

  return hitObjects;
}