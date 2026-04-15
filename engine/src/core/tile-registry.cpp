#include "core/tile-registry.h"

std::unordered_map<uint16_t, std::string> TileRegistry::tiles_;
std::vector<TileGameplayDef> TileRegistry::gameplayMap_;

void TileRegistry::RegisterTile(uint16_t id, const std::string& name, bool collide) {
    TileGameplayDef gameplay;
    gameplay.Collide = collide;
    gameplay.Support = !collide && id != 0;
    gameplay.FallThrough = !gameplay.Support;
    gameplay.Occludes = collide;
    RegisterTile(id, name, gameplay);
}

void TileRegistry::RegisterTile(uint16_t id, const std::string &name, const TileGameplayDef &gameplay) {
    tiles_[id] = name;
    if (id >= gameplayMap_.size()) {
        gameplayMap_.resize(id + 1);
    }
    gameplayMap_[id] = gameplay;
}

std::string TileRegistry::GetTileName(uint16_t id) {
    auto it = tiles_.find(id);
    return it != tiles_.end() ? it->second : "unknown";
}

bool TileRegistry::GetTileCollide(uint16_t id) {
    if (id >= gameplayMap_.size()) return false;
    return gameplayMap_[id].Collide;
}

bool TileRegistry::GetTileSupport(uint16_t id) {
    if (id >= gameplayMap_.size()) return false;
    return gameplayMap_[id].Support;
}

bool TileRegistry::GetTileFallThrough(uint16_t id) {
    if (id >= gameplayMap_.size()) return true;
    return gameplayMap_[id].FallThrough;
}

bool TileRegistry::GetTileRoof(uint16_t id) {
    if (id >= gameplayMap_.size()) return false;
    return gameplayMap_[id].Roof;
}

bool TileRegistry::GetTileOccludes(uint16_t id) {
    if (id >= gameplayMap_.size()) return false;
    return gameplayMap_[id].Occludes;
}

const TileConnectorDef *TileRegistry::GetTileConnector(uint16_t id) {
    if (id >= gameplayMap_.size()) return nullptr;
    const auto &connector = gameplayMap_[id].Connector;
    return connector.Type == TileConnectorType::None ? nullptr : &connector;
}

TileGameplayDef TileRegistry::GetTileGameplay(uint16_t id) {
    if (id >= gameplayMap_.size()) return TileGameplayDef{};
    return gameplayMap_[id];
}

std::unordered_map<uint16_t, std::string> TileRegistry::GetAllTiles() {
    return tiles_;
}
