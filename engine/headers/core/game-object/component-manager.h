#pragma once
#include <memory>
#include <vector>
#include <stdint.h>
#include "core/game-object/component.h"
#include "core/game-object/manager.h"

class GameObject;

class ComponentManager : public Manager
{
public:
  virtual void RemoveComponent(uint32_t entityId) {}
};

/**
 * TypedComponentManager<T> — Dense-vector component pool.
 * Index = entity ID for O(1) access. Cache-friendly iteration.
 * Components are owned by the manager, not by the entity.
 */
template <typename T>
class TypedComponentManager : public ComponentManager
{
protected:
  std::vector<std::unique_ptr<T>> _pool;

public:
  T *Get(uint32_t entityId)
  {
    if (entityId >= _pool.size() || !_pool[entityId])
      return nullptr;
    return _pool[entityId].get();
  }

  const T *Get(uint32_t entityId) const
  {
    if (entityId >= _pool.size() || !_pool[entityId])
      return nullptr;
    return _pool[entityId].get();
  }

  T *Add(uint32_t entityId, GameObject *owner)
  {
    if (entityId >= _pool.size())
      _pool.resize(entityId + 1);
    _pool[entityId] = std::make_unique<T>(owner);
    return _pool[entityId].get();
  }

  void RemoveComponent(uint32_t entityId) override
  {
    if (entityId < _pool.size())
      _pool[entityId].reset();
  }

  bool Has(uint32_t entityId) const
  {
    return entityId < _pool.size() && _pool[entityId] != nullptr;
  }

  const std::vector<std::unique_ptr<T>> &GetPool() const { return _pool; }
};