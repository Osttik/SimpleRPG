#pragma once
#include <memory>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include "core/game-object/game-object.h"
#include "core/game-context.h"
class GameWorldEngine;

class GameObjectManager {
private:
    std::unordered_map<uint32_t, std::unique_ptr<GameObject>> _entities;

    std::unordered_set<uint32_t> _dirtyIds;

    std::vector<std::uint32_t> _recentlyDestroyed;

    GameWorldEngine* _ctx = nullptr;

    void BindEntity(GameObject* obj);

public:
    void SetContext(GameWorldEngine* ctx) { _ctx = ctx; }

    GameObject* Instatiate(Point position, std::unique_ptr<Shape> shape);

    GameObject* CreateChest(Point position, std::unique_ptr<Shape> shape, float32 radius, int32_t chunkZ);

    void MarkForDestruction(uint32_t numericId);

    void CleanupDestroyed();

    void MarkDirty(uint32_t id);
    const std::unordered_set<uint32_t>& GetDirtyIds() const { return _dirtyIds; }
    void ClearDirty();

    GameObject* GetById(uint32_t id) const;

    const std::unordered_map<uint32_t, std::unique_ptr<GameObject>>& GetEntities() const { return _entities; }

    const std::vector<std::uint32_t>& GetRecentlyDestroyed() const { return _recentlyDestroyed; }
    void ClearRecentlyDestroyed() { _recentlyDestroyed.clear(); }
};