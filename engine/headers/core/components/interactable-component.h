#pragma once
#include <memory>
#include <string>
#include <vector>
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "math/rect.h"

enum class InteractionType
{
  None,
  Talk,
  Loot,
  Pickup,
  Mine,
  Station
};

struct InteractableComponent : public Component
{
  InteractionType Type = InteractionType::None;
  std::string Label;
  std::unique_ptr<Shape> TargetBounds;
  std::unique_ptr<Shape> SensorBounds;

  InteractableComponent(GameObject *owner) : Component(owner) {}
};

class InteractableComponentManager : public TypedComponentManager<InteractableComponent>
{
private:
  std::vector<bool> _targetBitset;
  std::vector<bool> _sensorBitset;

public:
  InteractableComponent *Ensure(uint32_t entityId, GameObject *owner);
  InteractableComponent *AddTarget(uint32_t entityId, GameObject *owner,
                                   InteractionType type, const std::string &label,
                                   std::unique_ptr<Shape> bounds);
  InteractableComponent *AddSensor(uint32_t entityId, GameObject *owner,
                                   std::unique_ptr<Shape> bounds);

  void RemoveComponent(uint32_t entityId) override;
  void OnTransformChanged(uint32_t entityId, const Point &previous, const Point &current) override;

  bool IsInteractable(uint32_t entityId) const;
  bool HasSensor(uint32_t entityId) const;
  bool CanInteract(uint32_t sourceId, uint32_t targetId) const;
  const Shape *GetTargetBounds(uint32_t entityId) const;
  const Shape *GetSensorBounds(uint32_t entityId) const;
};
