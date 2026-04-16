#include "game/managers/prop-manager.h"
#include "core/gameplay-constants.h"
#include "game/entities/chest-builder.h"
#include "game/entities/dropped-item-builder.h"
#include "game/entities/station-builder.h"
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

uint32_t PropManager::AddSmelter(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth = CHEST_HALF_SIZE;
  float32 halfHeight = CHEST_HALF_SIZE;
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);
  return StationBuilder::Build(engine, position, std::move(rect), radius, z, CraftingStationType::Smelter, "smelter", "Smelter");
}

uint32_t PropManager::AddAnvil(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth = CHEST_HALF_SIZE;
  float32 halfHeight = CHEST_HALF_SIZE;
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);
  return StationBuilder::Build(engine, position, std::move(rect), radius, z, CraftingStationType::Anvil, "anvil", "Anvil");
}

uint32_t PropManager::AddWorkbench(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth = CHEST_HALF_SIZE;
  float32 halfHeight = CHEST_HALF_SIZE;
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);
  return StationBuilder::Build(engine, position, std::move(rect), radius, z, CraftingStationType::Workbench, "workbench", "Workbench");
}

uint32_t PropManager::AddGrindstone(GameWorldEngine &engine, const Point &position, float32 radius, int32_t z)
{
  float32 halfWidth = CHEST_HALF_SIZE;
  float32 halfHeight = CHEST_HALF_SIZE;
  Point topLeft(position.X - halfWidth, position.Y - halfHeight, z);
  Point bottomRight(position.X + halfWidth, position.Y + halfHeight, z);
  auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);
  return StationBuilder::Build(engine, position, std::move(rect), radius, z, CraftingStationType::Grindstone, "grindstone", "Grindstone");
}

void PropManager::DestroyProp(GameWorldEngine &engine, uint32_t propId)
{
  engine.ObjectManager.MarkForDestruction(propId);
}
