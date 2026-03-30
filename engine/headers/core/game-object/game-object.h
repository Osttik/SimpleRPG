#pragma once
#include <memory>
#include <string>
#include <unordered_set>
#include "macros.h"
#include "managable.h"
#include "math/rect.h"
#include "core/game-object/transform.h"
class GameWorldEngine;
#include "core/game-object/component.h"
#include "core/inventory.h"

enum class InteractionType
{
  None,
  Talk,
  Loot,
  Mine
};

struct InteractionData
{
  InteractionType Type = InteractionType::None;
  std::string Label = "";
};

class GameObject : public ComponentBased, public WithId
{
public:
  TransformData Transform;

  READ_ONLY_COMPONENT(std::unique_ptr<Shape>, BoundingBox);
  READ_ONLY_COMPONENT_WITH_DEFAULT_VALUE(std::unique_ptr<InventoryManager>, Inventories, std::make_unique<InventoryManager>());
  READ_ONLY_COMPONENT_WITH_DEFAULT_VALUE(std::unique_ptr<InteractionData>, Interaction, nullptr);

  GameWorldEngine *Context = nullptr;

  std::string Type = "prop";
  float32 Radius = float32(0);

  uint32_t FocusedObjectId = 0;
  unsigned int PhysicsId = 0;

  bool IsStaticProp = false;
  bool IsPendingDestruction = false;

  GameObject(Point position, std::unique_ptr<Shape> rect)
      : Transform(position), _BoundingBox(std::move(rect)) {}
};

class Chest : public GameObject
{
public:
  Chest(Point position, std::unique_ptr<Shape> rect)
      : GameObject(position, std::move(rect))
  {
    Type = "chest";
    Interaction = std::make_unique<InteractionData>();
    Interaction->Type = InteractionType::Loot;
    Interaction->Label = "Chest";
    auto storage = std::make_unique<Inventory>(float32(500.0), float32(0.0));
    Inventories->EquipContainer(ContainerSlot::MainStorage, std::move(storage));
  }
};