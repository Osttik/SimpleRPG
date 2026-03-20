#include "game/tile-registry.h"

std::unordered_map<uint16_t, std::string> TileRegistry::tiles_;
std::vector<bool> TileRegistry::collisionMap_;

void TileRegistry::RegisterTile(uint16_t id, const std::string& name, bool collide) {
    tiles_[id] = name;
    if (id >= collisionMap_.size()) {
        collisionMap_.resize(id + 1, false);
    }
    collisionMap_[id] = collide;
}

std::string TileRegistry::GetTileName(uint16_t id) {
    auto it = tiles_.find(id);
    return it != tiles_.end() ? it->second : "unknown";
}

bool TileRegistry::GetTileCollide(uint16_t id) {
    if (id >= collisionMap_.size()) return false;
    return collisionMap_[id];
}

std::unordered_map<uint16_t, std::string> TileRegistry::GetAllTiles() {
    return tiles_;
}
