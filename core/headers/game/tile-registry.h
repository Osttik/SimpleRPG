#pragma once
#include <string>
#include <unordered_map>
#include <cstdint>

#include <vector>

class TileRegistry {
public:
    static void RegisterTile(uint16_t id, const std::string& name, bool collide);
    static std::string GetTileName(uint16_t id);
    static bool GetTileCollide(uint16_t id);
    static std::unordered_map<uint16_t, std::string> GetAllTiles();
private:
    static std::unordered_map<uint16_t, std::string> tiles_;
    static std::vector<bool> collisionMap_;
};
