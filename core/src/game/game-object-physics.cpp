#include "game/game-object-physics.h"

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