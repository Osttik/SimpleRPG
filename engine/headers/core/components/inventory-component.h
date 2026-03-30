#pragma once
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/game-object/game-object.h"
#include "core/inventory.h"

class InventoryComponentManager : public ComponentManager {
public:
    void AddComponentTo(GameObject* obj) override;
};

class InventoryComponent : public Component {
public:
    InventoryComponent(GameObject* owner) : Component(owner) {}
    Inventory* GetBackpack();
    Inventory* GetStorage();
};
