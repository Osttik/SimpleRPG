#pragma once
#include <memory>
#include <vector>
#include <stdint.h>

class GameObject;

class Component
{
public:
    GameObject *Owner = nullptr;

    Component() = default;
    explicit Component(GameObject *owner) : Owner(owner) {}
    virtual ~Component() = default;
};

class ComponentID
{
private:
    static inline uint32_t nextID = 0;

public:
    template <typename T>
    static uint32_t Get()
    {
        static uint32_t id = nextID++;
        return id;
    }
};
