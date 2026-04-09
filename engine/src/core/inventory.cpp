#include "core/inventory.h"

bool Item::CanStackWith(const Item &other) const
{
  if (!Stackable || !other.Stackable)
    return false;
  if (DefinitionId != other.DefinitionId ||
      MaxStack != other.MaxStack ||
      Volume != other.Volume ||
      Weight != other.Weight)
  {
    return false;
  }

  if (_features.size() != other._features.size())
    return false;

  for (const auto &feature : _features)
  {
    if (!feature)
      return false;

    const ItemFeature *otherFeature = nullptr;
    for (const auto &candidate : other._features)
    {
      if (candidate && candidate->TypeId() == feature->TypeId())
      {
        otherFeature = candidate.get();
        break;
      }
    }

    if (!otherFeature || !feature->IsStackCompatibleWith(*otherFeature))
      return false;
  }

  return true;
}

float32 Item::GetStackVolume() const
{
  return Volume * float32(Quantity);
}

float32 Item::GetStackWeight() const
{
  return Weight * float32(Quantity);
}

float32 Item::GetMerchantBaseValue() const
{
  const auto *valueFeature = GetFeature<MerchantValueFeature>();
  return valueFeature ? valueFeature->BaseValue : float32(0);
}

namespace ItemFactory
{
  std::unique_ptr<Item> CreateSword(int quantity)
  {
    auto sword = std::make_unique<Item>(
        "weapon.sword.iron",
        "Sword",
        "sword",
        float32(2.0),
        float32(5.0),
        false,
        1,
        quantity);

    sword->AddFeature<EquippableFeature>(std::vector<EquipSlot>{EquipSlot::MainHand});
    sword->AddFeature<WeaponFeature>(4, 8);
    sword->AddFeature<DurabilityFeature>(100, 100);
    sword->AddFeature<MerchantValueFeature>(float32(60.0));
    return sword;
  }

  std::unique_ptr<Item> CreateCoin(int quantity)
  {
    auto coin = std::make_unique<Item>(
        "currency.coin",
        "Coin",
        "coin",
        float32(0.01),
        float32(0.01),
        true,
        10000,
        quantity);

    coin->AddFeature<MerchantValueFeature>(float32(1.0));
    return coin;
  }
}

size_t Inventory::Count() const { return _items.size(); }

float32 Inventory::GetCurrentVolume()
{
  return _currentVolume;
}

float32 Inventory::GetAllWeight()
{
  return Weight + _currentWeight;
}

void Inventory::AddListener(InventoryListener *listener)
{
  if (!listener)
    return;
  if (std::find(_listeners.begin(), _listeners.end(), listener) != _listeners.end())
    return;
  _listeners.push_back(listener);
}

void Inventory::RemoveListener(InventoryListener *listener)
{
  auto it = std::remove(_listeners.begin(), _listeners.end(), listener);
  _listeners.erase(it, _listeners.end());
}

void Inventory::AddItem(std::unique_ptr<Item> itemPtr)
{
  if (!itemPtr)
    return;

  if (itemPtr->GetStackVolume() + _currentVolume > MaxCarryVolume)
    return;

  if (itemPtr->Stackable)
  {
    for (auto &item : _items)
    {
      if (!item || !item->CanStackWith(*itemPtr) || item->Quantity >= item->MaxStack)
        continue;

      const int space = item->MaxStack - item->Quantity;
      if (itemPtr->Quantity <= space)
      {
        item->Quantity += itemPtr->Quantity;
        _currentVolume += itemPtr->Volume * float32(itemPtr->Quantity);
        _currentWeight += itemPtr->Weight * float32(itemPtr->Quantity);
        return;
      }

      item->Quantity += space;
      itemPtr->Quantity -= space;
      _currentVolume += itemPtr->Volume * float32(space);
      _currentWeight += itemPtr->Weight * float32(space);
    }
  }

  _currentVolume += itemPtr->GetStackVolume();
  _currentWeight += itemPtr->GetStackWeight();

  _items.push_back(std::move(itemPtr));
}

std::unique_ptr<Item> Inventory::RemoveItem(size_t index)
{
  if (index >= _items.size())
    return nullptr;

  for (auto *listener : _listeners)
  {
    if (listener)
      listener->OnItemRemoved(*this, *_items[index]);
  }

  _currentVolume -= _items[index]->GetStackVolume();
  _currentWeight -= _items[index]->GetStackWeight();

  std::unique_ptr<Item> takenItem = std::move(_items[index]);
  _items.erase(_items.begin() + index);

  return takenItem;
}

bool InventoryOperator::TransferTo(Inventory &from, Inventory &to, size_t index)
{
  auto itemToMove = from[index];
  if (!itemToMove)
    return false;

  if (itemToMove->GetStackVolume() + to.GetCurrentVolume() > to.MaxCarryVolume)
  {
    return false;
  }

  std::unique_ptr<Item> item = from.RemoveItem(index);
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
