#pragma once
#include <vector>
#include <memory>
#include <algorithm>
#include <array>
#include <unordered_map>
#include <string>
#include "math/number.h"

enum class ContainerSlot : size_t
{
  Backpack,
  MainStorage,
  Count,
};

class ItemData
{
public:
  std::string Name;
  std::string SpriteKey;
  float32 Volume;
  float32 Weight;
  bool Stackable;
  int Quantity;
  int MaxStack;

  ItemData(std::string name, std::string spriteKey, float32 volume, float32 weight, bool stackable = false, int maxStack = 1, int quantity = 1)
      : Name(std::move(name)), SpriteKey(std::move(spriteKey)), Volume(volume), Weight(weight), Stackable(stackable), Quantity(quantity), MaxStack(maxStack) {}
  virtual ~ItemData() = default;
};

class Sword : public ItemData {
public:
  Sword() : ItemData("Sword", "sword", float32(2.0), float32(5.0), false, 1, 1) {}
};

class Coin : public ItemData {
public:
  Coin(int quantity = 1) : ItemData("Coin", "coin", float32(0.01), float32(0.01), true, 10000, quantity) {}
};

class Inventory
{
private:
  std::vector<std::unique_ptr<ItemData>> _items;
  float32 _currentVolume = float32(0);
  float32 _currentWeight = float32(0);

public:
  float32 MaxCarryVolume;
  float32 Weight;

  Inventory(float32 maxVolume, float32 weight) : MaxCarryVolume(maxVolume), Weight(weight) {}

  const ItemData *operator[](size_t index) const
  {
    if (index >= _items.size())
      return nullptr;
    return _items[index].get();
  }

  size_t Count() const;
  float32 GetCurrentVolume();
  float32 GetAllWeight();
  void AddItem(std::unique_ptr<ItemData> itemPtr);
  std::unique_ptr<ItemData> RemoveItem(size_t index);
};

class InventoryOperator
{
public:
  static bool TransferTo(Inventory &from, Inventory &to, size_t index);
};

class InventoryManager
{
private:
  std::array<std::unique_ptr<Inventory>, static_cast<size_t>(ContainerSlot::Count)> _containers;

public:
  void EquipContainer(ContainerSlot slot, std::unique_ptr<Inventory> inventory);

  std::unique_ptr<Inventory> UnequipContainer(ContainerSlot slot);

  Inventory *GetContainer(ContainerSlot slot) const;
};