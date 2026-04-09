#include "game/managers/prop-manager.h"
#include "core/gameplay-constants.h"
#include "game/entities/chest-builder.h"
#include "game/entities/dropped-item-builder.h"
#include "math/rect.h"

uint32_t PropManager::AddChest(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth = CHEST_HALF_SIZE;
  float32 halfHeight = CHEST_HALF_SIZE;
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);

  return ChestBuilder::Build(engine, position, std::move(rect), radius, z);
}

uint32_t PropManager::AddDroppedItem(GameWorldEngine &engine, const Point &position, std::unique_ptr<Item> item)
{
  return DroppedItemBuilder::Build(engine, position, std::move(item));
}

void PropManager::DestroyProp(GameWorldEngine &engine, uint32_t propId)
{
  engine.ObjectManager.MarkForDestruction(propId);
}
