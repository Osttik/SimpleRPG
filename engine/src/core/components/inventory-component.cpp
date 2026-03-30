#include "core/components/inventory-component.h"

void InventoryComponentManager::AddComponentTo(GameObject* obj)
{
    ComponentManager::AddComponentTo(obj);
    obj->AddComponent<InventoryComponent>(obj);

    // Equip a Backpack if not already present
    if (!obj->Inventories->GetContainer(ContainerSlot::Backpack)) {
        auto backpack = std::make_unique<Inventory>(float32(50.0), float32(0.0));
        obj->Inventories->EquipContainer(ContainerSlot::Backpack, std::move(backpack));
    }
}

Inventory* InventoryComponent::GetBackpack()
{
    return Owner->Inventories->GetContainer(ContainerSlot::Backpack);
}

Inventory* InventoryComponent::GetStorage()
{
    return Owner->Inventories->GetContainer(ContainerSlot::MainStorage);
}
