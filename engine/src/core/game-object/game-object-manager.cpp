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

GameObject *GameObjectManager::Instatiate(Point position, std::unique_ptr<Shape> shape)
{
    auto obj = std::make_unique<GameObject>(position, std::move(shape));

    uint32_t numId = obj->Id;
    GameObject *ptr = obj.get();
    _entities[numId] = std::move(obj);

    BindEntity(ptr);
    return ptr;
}

GameObject *GameObjectManager::CreateChest(Point position,
                                           std::unique_ptr<Shape> shape, float32 radius,
                                           int32_t chunkZ)
{
    auto obj = std::make_unique<Chest>(position, std::move(shape));
    obj->IsStaticProp = true;
    obj->Radius = radius;

    obj->Transform.SetZPosition(chunkZ);

    uint32_t numId = obj->Id;
    GameObject *ptr = obj.get();
    _entities[numId] = std::move(obj);

    BindEntity(ptr);
    return ptr;
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

            _ctx->Physics.RemoveObject(it->second->PhysicsId);

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