#include "game/inventory.h"

size_t Inventory::Count() const { return _items.size(); }

float32 Inventory::GetCurrentVolume()
{
  return _currentVolume;
}

float32 Inventory::GetAllWeight()
{
  return Weight + _currentWeight;
}

void Inventory::AddItem(std::unique_ptr<ItemData> itemPtr)
{
  if (!itemPtr)
    return;

  if (itemPtr->Volume * float32(itemPtr->Quantity) + _currentVolume > MaxCarryVolume)
    return;

  if (itemPtr->Stackable)
  {
    for (auto &item : _items)
    {
      if (item->Name == itemPtr->Name && item->Quantity < item->MaxStack)
      {
        int space = item->MaxStack - item->Quantity;
        if (itemPtr->Quantity <= space)
        {
          item->Quantity += itemPtr->Quantity;
          _currentVolume += itemPtr->Volume * float32(itemPtr->Quantity);
          _currentWeight += itemPtr->Weight * float32(itemPtr->Quantity);
          return;
        }
        else
        {
          item->Quantity += space;
          itemPtr->Quantity -= space;
          _currentVolume += itemPtr->Volume * float32(space);
          _currentWeight += itemPtr->Weight * float32(space);
        }
      }
    }
  }

  _currentVolume += itemPtr->Volume * float32(itemPtr->Quantity);
  _currentWeight += itemPtr->Weight * float32(itemPtr->Quantity);

  _items.push_back(std::move(itemPtr));
}

std::unique_ptr<ItemData> Inventory::RemoveItem(size_t index)
{
  if (index >= _items.size())
    return nullptr;

  _currentVolume -= _items[index]->Volume * float32(_items[index]->Quantity);
  _currentWeight -= _items[index]->Weight * float32(_items[index]->Quantity);

  std::unique_ptr<ItemData> takenItem = std::move(_items[index]);
  _items.erase(_items.begin() + index);

  return takenItem;
}

bool InventoryOperator::TransferTo(Inventory &from, Inventory &to, size_t index)
{
  auto itemToMove = from[index];
  if (!itemToMove)
    return false;

  if (itemToMove->Volume * float32(itemToMove->Quantity) + to.GetCurrentVolume() > to.MaxCarryVolume)
  {
    return false;
  }

  std::unique_ptr<ItemData> item = from.RemoveItem(index);
  to.AddItem(std::move(item));
  return true;
}

void InventoryManager::EquipContainer(ContainerSlot slot, std::unique_ptr<Inventory> inventory)
{
  _containers[static_cast<size_t>(slot)] = std::move(inventory);
}

std::unique_ptr<Inventory> InventoryManager::UnequipContainer(ContainerSlot slot)
{
  return std::move(_containers[static_cast<size_t>(slot)]);
}

Inventory *InventoryManager::GetContainer(ContainerSlot slot) const
{
  return _containers[static_cast<size_t>(slot)].get();
}