#include "core/physics-system.h"
#include "math/point.h"
#include "core/game-object-physics.h"
#include "core/components/interactable-component.h"

PhysicsSystem::PhysicsSystem()
{
    _aabbTree = std::make_unique<GameObjectPhysics>();
}

unsigned int PhysicsSystem::AddObject(GameObject *obj)
{
    return _aabbTree->AddObject(obj);
}

void PhysicsSystem::UpdateObject(unsigned int physicsId)
{
    _aabbTree->UpdateObject(physicsId);
}

void PhysicsSystem::RemoveObject(unsigned int physicsId)
{
    _aabbTree->RemoveObject(physicsId);
}

void PhysicsSystem::Tick(WorldManager *chunkManager, const std::unordered_set<uint32_t> &dirtyEntityIds)
{
    _aabbTree->Tick(chunkManager, dirtyEntityIds);
}

void PhysicsSystem::ResolveCircleCollision(GameObject *objA, GameObject *objB)
{
    if (objA->BoundingBox->Type != ShapeType::Circle || objB->BoundingBox->Type != ShapeType::Circle)
        return;

    Circle *circleA = static_cast<Circle *>(objA->BoundingBox.get());
    Circle *circleB = static_cast<Circle *>(objB->BoundingBox.get());

    float32 dx = circleB->Center.X - circleA->Center.X;
    float32 dy = circleB->Center.Y - circleA->Center.Y;
    float32 minDist = circleA->Radius + circleB->Radius;

    float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
    float32 absDy = dy < float32(0) ? float32(0) - dy : dy;
    if (absDx > minDist || absDy > minDist)
        return;

    float32 distSquared = dx * dx + dy * dy;
    float32 dist = fpm::sqrt(distSquared);

    if (dist == float32(0))
        dist = float32(0.0001);

    float32 normalX = dx / dist;
    float32 normalY = dy / dist;
    float32 overlap = minDist - dist;
    float32 pushDistance = overlap / float32(2);

    objA->Transform.SetPosition(Point(circleA->Center.X - normalX * pushDistance, circleA->Center.Y - normalY * pushDistance));
    objB->Transform.SetPosition(Point(circleB->Center.X + normalX * pushDistance, circleB->Center.Y + normalY * pushDistance));

    circleA->Center = objA->Transform.Position();
    circleB->Center = objB->Transform.Position();
}

void PhysicsSystem::UpdateFocus(GameObject *source, const Point &mousePosition,
                                const InteractableComponentManager *interactMgr)
{
    if (!source)
        return;

    source->FocusedObjectId = 0; // reset
    if (!interactMgr || !interactMgr->HasSensor(source->Id))
        return;

    const Shape *sensorBounds = interactMgr->GetSensorBounds(source->Id);
    if (!sensorBounds)
        return;

    Point topleft = sensorBounds->GetCornerPoint(CornerType::TopLeft);
    Point bottomright = sensorBounds->GetCornerPoint(CornerType::BottomRight);

    auto candidates = _aabbTree->GetObjectsInArea(topleft, bottomright);

    GameObject *bestTarget = nullptr;
    float32 bestScore(-1000000);
    float32 bestMouseDist(1000000);
    GameObject *mouseTarget = nullptr;

    for (GameObject *obj : candidates)
    {
        if (obj == source)
            continue;
        if (!interactMgr || !interactMgr->IsInteractable(obj->Id))
            continue;
        if (!interactMgr->CanInteract(source->Id, obj->Id))
            continue;

        float32 dx = obj->Transform.Position().X - source->Transform.Position().X;
        float32 dy = obj->Transform.Position().Y - source->Transform.Position().Y;
        float32 distSq = dx * dx + dy * dy;

        float32 dist = fpm::sqrt(distSq);
        if (dist == float32(0))
            dist = float32(0.0001);

        // Mouse Focus
        float32 mdx = obj->Transform.Position().X - mousePosition.X;
        float32 mdy = obj->Transform.Position().Y - mousePosition.Y;
        float32 mDistSq = mdx * mdx + mdy * mdy;

        float32 radius = float32(20);
        const Shape *targetBounds = interactMgr->GetTargetBounds(obj->Id);
        if (targetBounds && targetBounds->Type == ShapeType::Circle)
        {
            radius = static_cast<const Circle *>(targetBounds)->Radius;
        }
        float32 minMouseDistSq = radius * radius;

        if (mDistSq <= minMouseDistSq * float32(1.5))
        {
            if (mDistSq < bestMouseDist)
            {
                bestMouseDist = mDistSq;
                mouseTarget = obj;
            }
        }

        // Keyboard Focus
        float32 distanceScore = float32(1000) - dist;
        float32 score = distanceScore;

        if (score > bestScore)
        {
            bestScore = score;
            bestTarget = obj;
        }
    }

    // Store the numeric entity ID (WithId), not the physics ID
    if (mouseTarget)
    {
        source->FocusedObjectId = mouseTarget->Id;
    }
    else if (bestTarget)
    {
        source->FocusedObjectId = bestTarget->Id;
    }
}
