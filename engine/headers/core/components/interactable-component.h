#pragma once
#include <string>
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/game-object/game-object.h"  // InteractionType, InteractionData

class InteractableComponentManager : public ComponentManager {
public:
    void AddComponentTo(GameObject* obj) override;
};

class InteractableComponent : public Component {
public:
    InteractableComponent(GameObject* owner) : Component(owner) {}
    void Setup(InteractionType type, const std::string& label);
};
