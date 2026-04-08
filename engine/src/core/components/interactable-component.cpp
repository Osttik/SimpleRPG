#include "core/components/interactable-component.h"
#include "core/game-object/game-object.h"

InteractableComponent *InteractableComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *comp = Get(entityId);
  if (comp)
    return comp;
  return TypedComponentManager<InteractableComponent>::Add(entityId, owner);
}

InteractableComponent *InteractableComponentManager::AddTarget(
    uint32_t entityId, GameObject *owner,
    InteractionType type, const std::string &label,
    std::unique_ptr<Shape> bounds)
{
  auto *comp = Ensure(entityId, owner);
  comp->Type = type;
  comp->Label = label;
  comp->TargetBounds = std::move(bounds);

  if (entityId >= _targetBitset.size())
    _targetBitset.resize(entityId + 1, false);
  _targetBitset[entityId] = comp->TargetBounds != nullptr;

  return comp;
}

InteractableComponent *InteractableComponentManager::AddSensor(
    uint32_t entityId, GameObject *owner,
    std::unique_ptr<Shape> bounds)
{
  auto *comp = Ensure(entityId, owner);
  comp->SensorBounds = std::move(bounds);

  if (entityId >= _sensorBitset.size())
    _sensorBitset.resize(entityId + 1, false);
  _sensorBitset[entityId] = comp->SensorBounds != nullptr;

  return comp;
}

void InteractableComponentManager::RemoveComponent(uint32_t entityId)
{
  TypedComponentManager<InteractableComponent>::RemoveComponent(entityId);
  if (entityId < _targetBitset.size())
    _targetBitset[entityId] = false;
  if (entityId < _sensorBitset.size())
    _sensorBitset[entityId] = false;
}

void InteractableComponentManager::OnTransformChanged(uint32_t entityId, const Point &previous, const Point &current)
{
  auto *comp = Get(entityId);
  if (!comp)
    return;

  Point delta(current.X - previous.X, current.Y - previous.Y, current.Z - previous.Z);
  if (comp->TargetBounds)
    comp->TargetBounds->MoveBy(delta);
  if (comp->SensorBounds)
    comp->SensorBounds->MoveBy(delta);
}

bool InteractableComponentManager::IsInteractable(uint32_t entityId) const
{
  return entityId < _targetBitset.size() && _targetBitset[entityId];
}

bool InteractableComponentManager::HasSensor(uint32_t entityId) const
{
  return entityId < _sensorBitset.size() && _sensorBitset[entityId];
}

bool InteractableComponentManager::CanInteract(uint32_t sourceId, uint32_t targetId) const
{
  const auto *sourceComp = Get(sourceId);
  const auto *targetComp = Get(targetId);
  if (!sourceComp || !targetComp || !sourceComp->Owner || !targetComp->Owner)
    return false;

  // Interaction is only valid on the same Z layer.
  if (sourceComp->Owner->Transform.Position().Z != targetComp->Owner->Transform.Position().Z)
    return false;

  const auto *sensor = GetSensorBounds(sourceId);
  const auto *target = GetTargetBounds(targetId);
  if (!sensor || !target)
    return false;

  // Use center-distance reach check for circle-vs-circle interaction.
  // This keeps interaction range equal to the player's sensor radius,
  // instead of expanding it by target radius.
  if (sensor->Type == ShapeType::Circle && target->Type == ShapeType::Circle)
  {
    const auto *sensorCircle = static_cast<const Circle *>(sensor);
    const auto *targetCircle = static_cast<const Circle *>(target);
    const float32 dx = sensorCircle->Center.X - targetCircle->Center.X;
    const float32 dy = sensorCircle->Center.Y - targetCircle->Center.Y;
    const float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
    const float32 absDy = dy < float32(0) ? float32(0) - dy : dy;

    // fixed_16_16 overflows on large squared values; reject obvious out-of-range
    // candidates before squaring so distance math stays in safe bounds.
    if (absDx > sensorCircle->Radius || absDy > sensorCircle->Radius)
      return false;

    const float32 distanceSquared = (dx * dx) + (dy * dy);
    const float32 sensorRadiusSquared = sensorCircle->Radius * sensorCircle->Radius;
    return distanceSquared <= sensorRadiusSquared;
  }

  return RectOperator::Intersects(*sensor, *target);
}

const Shape *InteractableComponentManager::GetTargetBounds(uint32_t entityId) const
{
  const auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->TargetBounds.get();
}

const Shape *InteractableComponentManager::GetSensorBounds(uint32_t entityId) const
{
  const auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->SensorBounds.get();
}
