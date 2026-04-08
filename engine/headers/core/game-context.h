#pragma once
#include <vector>
#include <memory>
#include "managable.h"
#include "core/game-object/component-manager.h"

class GameObjectManager;
class PhysicsSystem;

class ComponentsManagersRegistry
{
private:
    std::vector<std::unique_ptr<ComponentManager>> _systems;

public:
    template <typename T>
    inline void Register(std::unique_ptr<T> system)
    {
        uint32_t id = SystemID::Get<T>();
        if (id >= _systems.size())
            _systems.resize(id + 1);
        _systems[id] = std::move(system);
    }

    template <typename T>
    inline T *Get()
    {
        uint32_t id = SystemID::Get<T>();
        if (id >= _systems.size() || !_systems[id])
            return nullptr;
        return static_cast<T *>(_systems[id].get());
    }

    void RemoveFromAll(uint32_t entityId)
    {
        for (auto &sys : _systems)
        {
            if (sys)
                sys->RemoveComponent(entityId);
        }
    }

    void OnTransformChanged(uint32_t entityId, const Point &previous, const Point &current)
    {
        for (auto &sys : _systems)
        {
            if (sys)
                sys->OnTransformChanged(entityId, previous, current);
        }
    }
};

struct GameContext
{
    ComponentsManagersRegistry *Managers = nullptr;
    GameObjectManager *Objects = nullptr;
    PhysicsSystem *Physics = nullptr;

    template <typename T>
    T *GetManager() { return Managers ? Managers->Get<T>() : nullptr; }
};
