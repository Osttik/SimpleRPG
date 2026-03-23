#pragma once
#include <memory>
#include <string>
#include "game/transform.h"
#include "math/rect.h"
#include "game/inventory.h"

enum class InteractionType {
  None,
  Talk,
  Loot,
  Mine
};

struct InteractionData {
  InteractionType Type = InteractionType::None;
  std::string Label = "";
};

class GameObject {
public:
  const TransformData Transform;
  const std::unique_ptr<Shape> BoundingBox;
  const std::unique_ptr<InventoryManager> Inventories = std::make_unique<InventoryManager>();
  std::unique_ptr<InteractionData> Interaction = nullptr;

  std::string Id = "";
  std::string Type = "prop";
  unsigned int PhysicsId = 0;
  unsigned int FocusedObjectId = 0;

  bool IsStaticProp = false;
  bool IsPendingDestruction = false;
  int32_t ChunkZ = 0;

  GameObject(TransformData transform, std::unique_ptr<Shape> rect)
      : Transform(transform), BoundingBox(std::move(rect)) {}
};

class Chest : public GameObject {
public:
  Chest(TransformData transform, std::unique_ptr<Shape> rect)
      : GameObject(transform, std::move(rect)) {
    Type = "chest";
    Interaction = std::make_unique<InteractionData>();
    Interaction->Type = InteractionType::Loot;
    Interaction->Label = "Chest";
    auto storage = std::make_unique<Inventory>(float32(500.0), float32(0.0));
    Inventories->EquipContainer(ContainerSlot::MainStorage, std::move(storage));
  }
};