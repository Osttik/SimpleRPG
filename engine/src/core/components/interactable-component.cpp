#include "core/components/interactable-component.h"

void InteractableComponentManager::AddComponentTo(GameObject* obj)
{
    ComponentManager::AddComponentTo(obj);
    obj->AddComponent<InteractableComponent>(obj);

    // Initialize Interaction data if not already present
    if (!obj->Interaction)
        obj->Interaction = std::make_unique<InteractionData>();
}

void InteractableComponent::Setup(InteractionType type, const std::string& label)
{
    if (!Owner->Interaction)
        Owner->Interaction = std::make_unique<InteractionData>();
    Owner->Interaction->Type  = type;
    Owner->Interaction->Label = label;
}
