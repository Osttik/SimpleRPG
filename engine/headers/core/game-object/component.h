#pragma once
#include <memory>
#include <vector>
#include <stdint.h>

// Forward declaration only — avoids circular include with game-object.h
class GameObject;

class Component {
public:
    GameObject* Owner = nullptr;

    Component(GameObject* owner): Owner(owner) {}
    virtual ~Component() = default;
};

class ComponentID {
private:
    static inline uint32_t nextID = 0;

public:
    template <typename T>
    static uint32_t Get();
};

class ComponentBased {
private:
    std::vector<std::unique_ptr<Component>> _components;

public:
    template <typename T, typename... Args>
    T* AddComponent(Args&&... args);

    template <typename T>
    T* GetComponent();
};

// ─── ComponentID template impl ───
template <typename T>
inline uint32_t ComponentID::Get() {
    static uint32_t id = nextID++;
    return id;
}

// ─── ComponentBased template impl ───
template <typename T, typename... Args>
T* ComponentBased::AddComponent(Args&&... args) {
    uint32_t id = ComponentID::Get<T>();
    if (id >= _components.size())
        _components.resize(id + 1);
    auto comp = std::make_unique<T>(std::forward<Args>(args)...);
    T* ptr = comp.get();
    _components[id] = std::move(comp);  // owner is set via constructor arg, NOT comp->Owner=this
    return ptr;
}

template <typename T>
T* ComponentBased::GetComponent() {
    uint32_t id = ComponentID::Get<T>();
    if (id < _components.size() && _components[id])
        return static_cast<T*>(_components[id].get());
    return nullptr;
}
