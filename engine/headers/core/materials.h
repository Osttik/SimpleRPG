#pragma once
#include <algorithm>
#include <cstdint>
#include <vector>

enum class MaterialId : uint8_t
{
  None = 0,
  Dirt = 1,
  Stone = 2,
  Iron = 3,
  Gold = 4,
  Clay = 5,
  Wood = 6,
  Char = 7,
  Ash = 8,
  ScrapMetal = 9,
};

struct MaterialPart
{
  MaterialId Id = MaterialId::None;
  uint8_t Share = 0;

  bool operator==(const MaterialPart &other) const
  {
    return Id == other.Id && Share == other.Share;
  }
};

struct MaterialComposition
{
  std::vector<MaterialPart> Parts;

  void Normalize()
  {
    Parts.erase(
        std::remove_if(
            Parts.begin(),
            Parts.end(),
            [](const MaterialPart &part)
            { return part.Id == MaterialId::None || part.Share == 0; }),
        Parts.end());

    std::sort(
        Parts.begin(),
        Parts.end(),
        [](const MaterialPart &a, const MaterialPart &b)
        { return static_cast<uint8_t>(a.Id) < static_cast<uint8_t>(b.Id); });
  }

  bool operator==(const MaterialComposition &other) const
  {
    return Parts == other.Parts;
  }
};
