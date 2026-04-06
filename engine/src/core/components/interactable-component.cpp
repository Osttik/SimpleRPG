#include "core/components/interactable-component.h"

InteractableComponent *InteractableComponentManager::Add(
    uint32_t entityId, GameObject *owner,
    InteractionType type, const std::string &label)
{
  auto *comp = TypedComponentManager<InteractableComponent>::Add(entityId, owner);
  comp->Type = type;
  comp->Label = label;

  if (entityId >= _interactableBitset.size())
    _interactableBitset.resize(entityId + 1, false);
  _interactableBitset[entityId] = true;

  return comp;
}

void InteractableComponentManager::RemoveComponent(uint32_t entityId)
{
  TypedComponentManager<InteractableComponent>::RemoveComponent(entityId);
  if (entityId < _interactableBitset.size())
    _interactableBitset[entityId] = false;
}

bool InteractableComponentManager::IsInteractable(uint32_t entityId) const
{
  return entityId < _interactableBitset.size() && _interactableBitset[entityId];
}
