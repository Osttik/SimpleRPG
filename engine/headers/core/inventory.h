#pragma once
#include <algorithm>
#include <array>
#include <memory>
#include <string>
#include <utility>
#include <vector>
#include <stdint.h>
#include "core/gameplay-constants.h"
#include "core/materials.h"
#include "core/tool-interaction.h"
#include "math/number.h"

enum class ContainerSlot : size_t
{
  Backpack,
  MainStorage,
  Count,
};

class ItemFeatureType
{
private:
  static inline uint32_t NextId = 0;

public:
  template <typename T>
  static uint32_t Get()
  {
    static uint32_t id = NextId++;
    return id;
  }
};

class ItemFeature
{
public:
  virtual ~ItemFeature() = default;
  virtual uint32_t TypeId() const = 0;
  virtual bool IsStackCompatibleWith(const ItemFeature &other) const = 0;
};

enum class EquipSlot : uint8_t
{
  None,
  Head,
  Chest,
  Legs,
  Feet,
  HandPrimary,
  HandSecondary,
};

class EquippableFeature : public ItemFeature
{
public:
  std::vector<EquipSlot> AllowedSlots;

  explicit EquippableFeature(std::vector<EquipSlot> allowedSlots)
      : AllowedSlots(std::move(allowedSlots)) {}

  uint32_t TypeId() const override { return ItemFeatureType::Get<EquippableFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const EquippableFeature *>(&other);
    return typed && AllowedSlots == typed->AllowedSlots;
  }
};

class DurabilityFeature : public ItemFeature
{
public:
  int Current = 0;
  int Max = 0;

  DurabilityFeature(int current, int max) : Current(current), Max(max) {}

  uint32_t TypeId() const override { return ItemFeatureType::Get<DurabilityFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const DurabilityFeature *>(&other);
    return typed && Current == typed->Current && Max == typed->Max;
  }
};

class WeaponFeature : public ItemFeature
{
public:
  int MinDamage = 0;
  int MaxDamage = 0;

  WeaponFeature(int minDamage, int maxDamage) : MinDamage(minDamage), MaxDamage(maxDamage) {}

  uint32_t TypeId() const override { return ItemFeatureType::Get<WeaponFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const WeaponFeature *>(&other);
    return typed && MinDamage == typed->MinDamage && MaxDamage == typed->MaxDamage;
  }
};

class MerchantValueFeature : public ItemFeature
{
public:
  float32 BaseValue = float32(0);

  explicit MerchantValueFeature(float32 baseValue) : BaseValue(baseValue) {}

  uint32_t TypeId() const override { return ItemFeatureType::Get<MerchantValueFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const MerchantValueFeature *>(&other);
    return typed && BaseValue == typed->BaseValue;
  }
};

class ToolFeature : public ItemFeature
{
public:
  MiningToolStats Mining;

  explicit ToolFeature(MiningToolStats mining) : Mining(std::move(mining)) {}

  uint32_t TypeId() const override { return ItemFeatureType::Get<ToolFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const ToolFeature *>(&other);
    return typed &&
           typed->Mining.Class == Mining.Class &&
           typed->Mining.BasePower == Mining.BasePower &&
           typed->Mining.SoftMultiplierPct == Mining.SoftMultiplierPct &&
           typed->Mining.StrongMultiplierPct == Mining.StrongMultiplierPct &&
           typed->Mining.PreferredToolBonus == Mining.PreferredToolBonus;
  }
};

class MaterialCompositionFeature : public ItemFeature
{
public:
  MaterialComposition Composition;

  explicit MaterialCompositionFeature(MaterialComposition composition) : Composition(std::move(composition))
  {
    Composition.Normalize();
  }

  uint32_t TypeId() const override { return ItemFeatureType::Get<MaterialCompositionFeature>(); }

  bool IsStackCompatibleWith(const ItemFeature &other) const override
  {
    const auto *typed = dynamic_cast<const MaterialCompositionFeature *>(&other);
    return typed && typed->Composition == Composition;
  }
};

class Item
{
private:
  std::vector<std::unique_ptr<ItemFeature>> _features;

public:
  std::string DefinitionId;
  std::string Name;
  std::string SpriteKey;
  float32 Volume;
  float32 Weight;
  bool Stackable;
  int Quantity;
  int MaxStack;

  Item(std::string definitionId, std::string name, std::string spriteKey, float32 volume, float32 weight,
       bool stackable = false, int maxStack = 1, int quantity = 1)
      : DefinitionId(std::move(definitionId)),
        Name(std::move(name)),
        SpriteKey(std::move(spriteKey)),
        Volume(volume),
        Weight(weight),
        Stackable(stackable),
        Quantity(quantity),
        MaxStack(maxStack) {}

  template <typename T, typename... TArgs>
  T *AddFeature(TArgs &&...args)
  {
    auto feature = std::make_unique<T>(std::forward<TArgs>(args)...);
    auto *raw = feature.get();
    _features.push_back(std::move(feature));
    return raw;
  }

  template <typename T>
  T *GetFeature()
  {
    const Item *constSelf = this;
    return const_cast<T *>(constSelf->GetFeature<T>());
  }

  template <typename T>
  const T *GetFeature() const
  {
    const uint32_t wantedTypeId = ItemFeatureType::Get<T>();
    for (const auto &feature : _features)
    {
      if (feature && feature->TypeId() == wantedTypeId)
        return static_cast<const T *>(feature.get());
    }
    return nullptr;
  }

  template <typename T>
  bool HasFeature() const
  {
    return GetFeature<T>() != nullptr;
  }

  bool CanStackWith(const Item &other) const;
  float32 GetStackVolume() const;
  float32 GetStackWeight() const;
  float32 GetMerchantBaseValue() const;
};

class Inventory;

class InventoryListener
{
public:
  virtual ~InventoryListener() = default;
  virtual void OnItemRemoved(Inventory &inventory, const Item &item) = 0;
};

namespace ItemFactory
{
  std::unique_ptr<Item> CreateSword(int quantity = 1);
  std::unique_ptr<Item> CreatePickaxe(int quantity = 1);
  std::unique_ptr<Item> CreateShovel(int quantity = 1);
  std::unique_ptr<Item> CreateCoin(int quantity = 1);
  std::unique_ptr<Item> CreateDirtChunk(int quantity = 1);
  std::unique_ptr<Item> CreateStoneSlab(int quantity = 1);
  std::unique_ptr<Item> CreateGoldPiece(int quantity = 1);
  std::unique_ptr<Item> CreateByDefinitionId(const std::string &definitionId, int quantity = 1);
}

class Inventory
{
private:
  std::vector<std::unique_ptr<Item>> _items;
  float32 _currentVolume = float32(0);
  float32 _currentWeight = float32(0);

public:
  float32 MaxCarryVolume;
  float32 MaxCarryWeight;
  float32 Weight;

  Inventory(float32 maxVolume, float32 weight, float32 maxWeight = DEFAULT_INVENTORY_MAX_WEIGHT)
      : MaxCarryVolume(maxVolume), MaxCarryWeight(maxWeight), Weight(weight) {}

  const Item *operator[](size_t index) const
  {
    if (index >= _items.size())
      return nullptr;
    return _items[index].get();
  }

  size_t Count() const;
  float32 GetCurrentVolume();
  float32 GetAllWeight() const;
  bool CanAccept(const Item &item) const;
  void AddListener(InventoryListener *listener);
  void RemoveListener(InventoryListener *listener);
  bool AddItem(std::unique_ptr<Item> itemPtr);
  std::unique_ptr<Item> RemoveItem(size_t index);

private:
  std::vector<InventoryListener *> _listeners;
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
