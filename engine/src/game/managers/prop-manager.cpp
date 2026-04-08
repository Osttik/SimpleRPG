#include "game/managers/prop-manager.h"
#include "game/entities/chest-builder.h"
#include "math/rect.h"

uint32_t PropManager::AddChest(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth(16.0);
  float32 halfHeight(16.0);
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);

  return ChestBuilder::Build(engine, position, std::move(rect), radius, z);
}

void PropManager::DestroyProp(GameWorldEngine &engine, uint32_t propId)
{
  engine.ObjectManager.MarkForDestruction(propId);
}
