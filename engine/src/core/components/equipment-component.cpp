#include "core/components/equipment-component.h"

namespace
{
  constexpr size_t EquipSlotIndex(EquipSlot slot)
  {
    return static_cast<size_t>(slot);
  }
}

EquipmentComponent::~EquipmentComponent()
{
  DetachInventory();
}

void EquipmentComponent::AttachInventory(Inventory *inventory)
{
  if (ObservedInventory == inventory)
    return;

  DetachInventory();
  ObservedInventory = inventory;
  if (ObservedInventory)
    ObservedInventory->AddListener(this);
}

void EquipmentComponent::DetachInventory()
{
  if (ObservedInventory)
    ObservedInventory->RemoveListener(this);
  ObservedInventory = nullptr;

  for (auto &slot : Slots)
    slot.ItemRef = nullptr;
}

void EquipmentComponent::OnItemRemoved(Inventory &, const Item &item)
{
  for (auto &slot : Slots)
  {
    if (slot.ItemRef == &item)
      slot.ItemRef = nullptr;
  }
}

EquipmentComponent *EquipmentComponentManager::Ensure(uint32_t entityId, GameObject *owner, InventoryComponentManager *inventoryMgr)
{
  if (!inventoryMgr || !inventoryMgr->Has(entityId))
    throw std::runtime_error("EquipmentComponent requires InventoryComponent");

  auto *backpack = inventoryMgr->GetContainer(entityId, ContainerSlot::Backpack);
  if (!backpack)
    throw std::runtime_error("EquipmentComponent requires backpack inventory");

  auto *comp = Get(entityId);
  if (!comp)
    comp = Add(entityId, owner);

  comp->AttachInventory(backpack);
  return comp;
}

void EquipmentComponentManager::RemoveComponent(uint32_t entityId)
{
  if (auto *comp = Get(entityId))
    comp->DetachInventory();
  TypedComponentManager<EquipmentComponent>::RemoveComponent(entityId);
}

bool EquipmentComponentManager::ToggleEquip(uint32_t entityId, size_t itemIndex, InventoryComponentManager *inventoryMgr, GameObject *owner)
{
  auto *comp = Ensure(entityId, owner, inventoryMgr);
  auto *inventory = inventoryMgr->GetContainer(entityId, ContainerSlot::Backpack);
  if (!comp || !inventory)
    return false;

  const Item *item = (*inventory)[itemIndex];
  if (!item)
    return false;

  const auto *equippable = item->GetFeature<EquippableFeature>();
  if (!equippable || equippable->AllowedSlots.empty())
    return false;

  for (const auto slot : equippable->AllowedSlots)
  {
    auto &entry = comp->Slots[EquipSlotIndex(slot)];
    if (entry.ItemRef == item)
    {
      entry.ItemRef = nullptr;
      return true;
    }
  }

  for (const auto slot : equippable->AllowedSlots)
  {
    auto &entry = comp->Slots[EquipSlotIndex(slot)];
    if (!entry.ItemRef)
    {
      entry.ItemRef = item;
      return true;
    }
  }

  comp->Slots[EquipSlotIndex(equippable->AllowedSlots.front())].ItemRef = item;
  return true;
}

const Item *EquipmentComponentManager::GetEquippedItem(uint32_t entityId, EquipSlot slot) const
{
  const auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->Slots[EquipSlotIndex(slot)].ItemRef;
}

EquipSlot EquipmentComponentManager::GetEquippedSlotFor(uint32_t entityId, const Item *item) const
{
  const auto *comp = Get(entityId);
  if (!comp || !item)
    return EquipSlot::None;

  for (size_t i = 0; i < comp->Slots.size(); ++i)
  {
    if (comp->Slots[i].ItemRef == item)
      return static_cast<EquipSlot>(i);
  }

  return EquipSlot::None;
}

bool EquipmentComponentManager::IsEquipped(uint32_t entityId, const Item *item) const
{
  const auto *comp = Get(entityId);
  if (!comp || !item)
    return false;

  for (const auto &slot : comp->Slots)
  {
    if (slot.ItemRef == item)
      return true;
  }
  return false;
}

std::string EquipmentComponentManager::SlotName(EquipSlot slot)
{
  switch (slot)
  {
  case EquipSlot::None:
    return "";
  case EquipSlot::Head:
    return "Head";
  case EquipSlot::Chest:
    return "Chest";
  case EquipSlot::Legs:
    return "Legs";
  case EquipSlot::Feet:
    return "Feet";
  case EquipSlot::HandPrimary:
    return "Hand 1";
  case EquipSlot::HandSecondary:
    return "Hand 2";
  default:
    return "Unknown";
  }
}
