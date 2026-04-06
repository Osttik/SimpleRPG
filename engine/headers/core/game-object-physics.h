#pragma once
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <algorithm>
#include "math/aabb.h"
#include "math/number.h"
#include "core/game-object/game-object.h"
#include "core/world.h"

class GameObjectPhysics
{
private:
  aabb::Tree tree;
  std::unordered_map<unsigned int, GameObject *> objects;
  unsigned int nextId = 0;

  void GetWorldBounds(GameObject *obj, std::vector<float32> &lower, std::vector<float32> &upper);

public:
  GameObjectPhysics() : tree(2, float32(0.05), 100, true) {}

  unsigned int AddObject(GameObject *obj);
  void RemoveObject(unsigned int id);
  void UpdateObject(unsigned int id);

  void Tick(WorldManager *world, const std::unordered_set<uint32_t> &dirtyEntityIds);

  std::vector<GameObject *> GetObjectsInArea(Point areaTopLeft, Point areaBottomRight);
};