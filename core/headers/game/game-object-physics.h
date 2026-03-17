#include <unordered_map>
#include <vector>
#include <algorithm>
#include "math/aabb.h"
#include "game/game-object.h"
#include "math/number.h"

class GameObjectPhysics
{
private:
  aabb::Tree tree;
  std::unordered_map<unsigned int, GameObject *> objects;
  unsigned int nextId = 0;
  void GetWorldBounds(GameObject *obj, std::vector<float32> &lower, std::vector<float32> &upper);

public:
  GameObjectPhysics(): tree(2, float32(0.05), 100, true) {}

  unsigned int AddObject(GameObject *obj);

  void UpdateObject(unsigned int id);

  std::vector<GameObject *> GetObjectsInArea(Point areaTopLeft, Point areaBottomRight);
};