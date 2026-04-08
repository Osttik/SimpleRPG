#include "core/game-object/game-object-manager.h"
#include "core/game-world-engine.h"
#include "core/physics-system.h"

void GameObjectManager::BindEntity(GameObject *obj)
{
    uint32_t numId = obj->Id;

    obj->Context = _ctx;
    obj->Transform.Bind(_ctx, numId);

    obj->PhysicsId = _ctx->Physics.AddObject(obj);

    MarkDirty(numId);
}

GameObject *GameObjectManager::Instantiate(Point position, std::unique_ptr<Shape> shape)
{
    auto obj = std::make_unique<GameObject>(position, std::move(shape));

    uint32_t numId = obj->Id;
    GameObject *ptr = obj.get();
    _entities[numId] = std::move(obj);

    BindEntity(ptr);
    return ptr;
}

void GameObjectManager::OnTransformPositionChanged(uint32_t id, const Point &previous, const Point &current)
{
    auto *obj = GetById(id);
    if (!obj)
        return;

    Point delta(current.X - previous.X, current.Y - previous.Y, current.Z - previous.Z);
    obj->BoundingBox->MoveBy(delta);

    if (_ctx)
        _ctx->Managers.OnTransformChanged(id, previous, current);

    MarkDirty(id);
}

void GameObjectManager::OnTransformStateChanged(uint32_t id)
{
    MarkDirty(id);
}

void GameObjectManager::MarkForDestruction(uint32_t numericId)
{
    auto it = _entities.find(numericId);
    if (it != _entities.end())
    {
        it->second->IsPendingDestruction = true;
    }
}

void GameObjectManager::CleanupDestroyed()
{
    _recentlyDestroyed.clear();

    for (auto it = _entities.begin(); it != _entities.end();)
    {
        if (it->second->IsPendingDestruction)
        {
            uint32_t numId = it->first;
            _recentlyDestroyed.push_back(numId);

            _ctx->Physics.RemoveObject(it->second->PhysicsId);

            // Remove all components from all managers
            _ctx->Managers.RemoveFromAll(numId);

            _dirtyIds.erase(numId);

            it = _entities.erase(it);
        }
        else
        {
            ++it;
        }
    }
}

void GameObjectManager::MarkDirty(uint32_t id)
{
    _dirtyIds.insert(id);
}

void GameObjectManager::ClearDirty()
{
    _dirtyIds.clear();
}

GameObject *GameObjectManager::GetById(uint32_t id) const
{
    auto it = _entities.find(id);
    if (it != _entities.end())
    {
        return it->second.get();
    }
    return nullptr;
}
