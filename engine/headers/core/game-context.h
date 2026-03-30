#pragma once
#include <vector>
#include <memory>
#include "managable.h"
#include "core/game-object/component-manager.h"

// Forward declarations only — no includes to avoid circular chains through game-object.h
class MoveComponentManager;
class InteractableComponentManager;
class InventoryComponentManager;

class GameContext {
public:
    MoveComponentManager*         MoveComponentManagerRef         = nullptr;
    InteractableComponentManager* InteractableComponentManagerRef = nullptr;
    InventoryComponentManager*    InventoryComponentManagerRef    = nullptr;
};

class ComponentsManagersRegistry
{
private:
    std::vector<std::unique_ptr<ComponentManager>> _systems;

public:
    template <typename T>
    inline void Register(std::unique_ptr<T> system) {
        uint32_t id = SystemID::Get<T>();
        if (id >= _systems.size())
            _systems.resize(id + 1);
        _systems[id] = std::move(system);
    }

    template <typename T>
    inline T* Get() {
        uint32_t id = SystemID::Get<T>();
        if (id >= _systems.size() || !_systems[id])
            return nullptr;
        return static_cast<T*>(_systems[id].get());
    }
};

class ComponentManagerTypes {
public:
    uint32_t MoveManager      = 0;
    uint32_t InteractManager  = 0;
    uint32_t InventoryManager = 0;
};
