#pragma once
#include <string>
#include <vector>
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"

enum class InteractionType
{
  None,
  Talk,
  Loot,
  Mine
};

struct InteractableComponent : public Component
{
  InteractionType Type = InteractionType::None;
  std::string Label;

  InteractableComponent(GameObject *owner) : Component(owner) {}
};

class InteractableComponentManager : public TypedComponentManager<InteractableComponent>
{
private:
  std::vector<bool> _interactableBitset;

public:
  InteractableComponent *Add(uint32_t entityId, GameObject *owner,
                             InteractionType type, const std::string &label);

  void RemoveComponent(uint32_t entityId) override;

  bool IsInteractable(uint32_t entityId) const;
};
