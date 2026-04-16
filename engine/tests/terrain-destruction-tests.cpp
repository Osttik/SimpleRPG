#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include "core/game-world-engine.h"
#include "core/components/inventory-component.h"
#include "core/inventory.h"
#include "core/tool-interaction.h"
#include "math/rect.h"

namespace
{
constexpr uint16_t TILE_AIR = 0;
constexpr uint16_t TILE_DIRT = 50;
constexpr uint16_t TILE_DIRT_DAMAGED_1 = 51;
constexpr uint16_t TILE_DIRT_DAMAGED_2 = 52;
constexpr uint16_t TILE_STONE_FLOOR = 53;
constexpr uint16_t TILE_GOLD_ORE = 54;

TileGameplayDef MakeSupportTile()
{
  TileGameplayDef def;
  def.Support = true;
  def.FallThrough = false;
  return def;
}

TileGameplayDef MakeDestructibleDirt()
{
  TileGameplayDef def = MakeSupportTile();
  def.Destruction.Destructible = true;
  def.Destruction.MaxIntegrity = 6;
  def.Destruction.MiningResistance = 0;
  def.Destruction.StrengthClass = TileStrengthClass::Soft;
  def.Destruction.PreferredTool = ToolClass::Shovel;
  def.Destruction.StageVisualTileIds = {TILE_DIRT_DAMAGED_1, TILE_DIRT_DAMAGED_2};
  def.Destruction.DestroyedTileId = TILE_AIR;
  def.Destruction.Stages = {
      TileDestructionStageDef{2, {TileStageLootDef{"resource.dirt_chunk", 1}}},
      TileDestructionStageDef{4, {TileStageLootDef{"resource.dirt_chunk", 1}}},
  };
  return def;
}

TileGameplayDef MakeDirtDamaged(uint8_t visualStage)
{
  TileGameplayDef def = MakeSupportTile();
  def.DamageVisualStage = visualStage;
  return def;
}

TileGameplayDef MakeDestructibleStone()
{
  TileGameplayDef def = MakeSupportTile();
  def.Destruction.Destructible = true;
  def.Destruction.MaxIntegrity = 8;
  def.Destruction.MiningResistance = 2;
  def.Destruction.StrengthClass = TileStrengthClass::Strong;
  def.Destruction.PreferredTool = ToolClass::Pickaxe;
  def.Destruction.DestroyedTileId = TILE_AIR;
  def.Destruction.Stages = {
      TileDestructionStageDef{3, {TileStageLootDef{"resource.stone_slab", 1}}},
      TileDestructionStageDef{6, {TileStageLootDef{"resource.stone_slab", 1}}},
  };
  return def;
}

TileGameplayDef MakeGoldOre()
{
  TileGameplayDef def = MakeSupportTile();
  def.Destruction.Destructible = true;
  def.Destruction.MaxIntegrity = 9;
  def.Destruction.MiningResistance = 3;
  def.Destruction.StrengthClass = TileStrengthClass::Strong;
  def.Destruction.PreferredTool = ToolClass::Pickaxe;
  def.Destruction.DestroyedTileId = TILE_AIR;
  def.Destruction.Stages = {
      TileDestructionStageDef{3, {TileStageLootDef{"resource.stone_slab", 1}}},
      TileDestructionStageDef{7, {TileStageLootDef{"resource.gold_piece", 1}}},
  };
  return def;
}

void Require(bool condition, const std::string &message)
{
  if (!condition)
    throw std::runtime_error(message);
}

void RegisterTiles(GameWorldEngine &engine)
{
  engine.SetTileRegistry({
      {TILE_DIRT, "test_dirt", MakeDestructibleDirt()},
      {TILE_DIRT_DAMAGED_1, "test_dirt_damaged_1", MakeDirtDamaged(1)},
      {TILE_DIRT_DAMAGED_2, "test_dirt_damaged_2", MakeDirtDamaged(2)},
      {TILE_STONE_FLOOR, "test_stone_floor", MakeDestructibleStone()},
      {TILE_GOLD_ORE, "test_gold_ore", MakeGoldOre()},
  });
}

void ClearArea(GameWorldEngine &engine, int minX, int maxX, int minY, int maxY, int minZ, int maxZ)
{
  for (int z = minZ; z <= maxZ; ++z)
  {
    for (int y = minY; y <= maxY; ++y)
    {
      for (int x = minX; x <= maxX; ++x)
      {
        engine.World.ChunkManager->SetTileAt(x, y, z, TILE_AIR);
      }
    }
  }
}

uint32_t SpawnPlayer(GameWorldEngine &engine, int32_t z = 0)
{
  return engine.Players.AddPlayer(engine, Point(float32(20), float32(20), z));
}

void TestStageThresholdsGrantOnce()
{
  GameWorldEngine engine;
  RegisterTiles(engine);
  ClearArea(engine, 0, 0, 0, 0, 0, 0);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_DIRT);

  auto first = engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 2);
  Require(first.CurrentStage == 1, "First hit should cross stage one.");
  Require(first.Rewards.size() == 1 && first.Rewards[0].ItemDefinitionId == "resource.dirt_chunk",
          "First threshold should grant dirt exactly once.");

  auto second = engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 1);
  Require(second.Rewards.empty(), "Damage inside the same stage should not grant extra loot.");

  auto third = engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 1);
  Require(third.CurrentStage == 2, "Third hit should cross the second stage.");
  Require(third.Rewards.size() == 1 && third.Rewards[0].ItemDefinitionId == "resource.dirt_chunk",
          "Second threshold should grant its reward exactly once.");
}

void TestMultiThresholdHitsGrantAllNewRewards()
{
  GameWorldEngine engine;
  RegisterTiles(engine);
  ClearArea(engine, 0, 0, 0, 0, 0, 0);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_DIRT);

  auto result = engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 5);
  Require(result.CurrentStage == 2, "Large hit should cross multiple stages.");
  Require(result.Rewards.size() == 2, "Large hit should grant all newly crossed stage rewards.");
}

void TestToolEffectiveness()
{
  const MiningToolStats pickaxe{ToolClass::Pickaxe, 3, 80, 150, 2};
  const MiningToolStats shovel{ToolClass::Shovel, 3, 150, 70, 2};
  const MiningTileProfile softTile{TileStrengthClass::Soft, ToolClass::Shovel, 0};
  const MiningTileProfile strongTile{TileStrengthClass::Strong, ToolClass::Pickaxe, 2};

  Require(ResolveMiningDamage(&shovel, softTile) > ResolveMiningDamage(&pickaxe, softTile),
          "Shovel should outperform pickaxe on soft tiles.");
  Require(ResolveMiningDamage(&pickaxe, strongTile) > ResolveMiningDamage(&shovel, strongTile),
          "Pickaxe should outperform shovel on strong tiles.");
}

void TestSparseOverrideResolvesWithoutMutatingBaseTile()
{
  GameWorldEngine engine;
  RegisterTiles(engine);
  ClearArea(engine, 0, 0, 0, 0, 0, 0);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_DIRT);

  auto result = engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 6);
  Require(result.Destroyed, "Full damage should destroy the tile.");
  Require(engine.World.ChunkManager->GetBaseTileAt(0, 0, 0) == TILE_DIRT,
          "Sparse terrain damage must preserve the authored base tile.");
  Require(engine.World.ChunkManager->GetTileAt(0, 0, 0) == TILE_AIR,
          "Resolved lookup should expose the destroyed replacement tile.");

  auto resolvedChunk = engine.World.ChunkManager->BuildResolvedChunkTiles(0, 0, 0);
  Require(!resolvedChunk.empty() && resolvedChunk[0] == TILE_AIR,
          "Chunk serialization should use resolved tiles, not base tiles.");
}

void TestLayeredSupportUsesDestroyedResolvedTile()
{
  GameWorldEngine engine;
  RegisterTiles(engine);
  engine.Layers.SetDebugEnabled(true);
  ClearArea(engine, 0, 0, 0, 0, -1, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_DIRT);
  engine.World.ChunkManager->SetTileAt(0, 0, -1, TILE_STONE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 0);
  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player != nullptr, "Missing spawned player.");
  player->Radius = float32(10);
  auto *circle = static_cast<Circle *>(player->BoundingBox.get());
  Require(circle != nullptr, "Expected circular player bounds.");
  circle->Radius = float32(10);
  engine.World.ChunkManager->ApplyTileDamage(0, 0, 0, 6);
  engine.Tick();

  player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == -1,
          "Layer support checks should observe resolved destroyed tiles and force a fall.");
}

void TestGoldStackabilityAndMaterialComposition()
{
  auto goldA = ItemFactory::CreateGoldPiece(1);
  auto goldB = ItemFactory::CreateGoldPiece(2);
  auto stoneA = ItemFactory::CreateStoneSlab(1);
  auto stoneB = ItemFactory::CreateStoneSlab(1);

  Require(goldA->Stackable, "Gold pieces should be stackable in v1.");
  Require(goldA->CanStackWith(*goldB), "Gold pieces with identical composition should stack.");
  Require(!stoneA->Stackable, "Stone slabs should stay non-stackable in v1.");
  Require(!stoneA->CanStackWith(*stoneB), "Non-stackable extracted slabs should not merge.");

  const auto *goldComposition = goldA->GetFeature<MaterialCompositionFeature>();
  const auto *stoneComposition = stoneA->GetFeature<MaterialCompositionFeature>();
  Require(goldComposition && goldComposition->Composition.Parts.size() == 1 &&
              goldComposition->Composition.Parts[0].Id == MaterialId::Gold,
          "Gold resource items should carry gold composition.");
  Require(stoneComposition && !stoneComposition->Composition.Parts.empty(),
          "Extracted stone should carry material composition data.");
}

void TestMineTileGrantsInventoryLoot()
{
  GameWorldEngine engine;
  RegisterTiles(engine);
  ClearArea(engine, 0, 0, 0, 0, -1, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_DIRT);
  engine.World.ChunkManager->SetTileAt(0, 0, -1, TILE_STONE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 0);
  auto *inventoryMgr = engine.Ctx.GetManager<InventoryComponentManager>();
  Require(inventoryMgr, "Inventory manager missing.");
  Require(inventoryMgr->AddItem(playerId, ContainerSlot::Backpack, ItemFactory::CreateShovel()),
          "Failed to add test shovel.");
  Require(engine.ToggleEquipItem(playerId, 0), "Failed to equip shovel.");

  Require(engine.MineTile(playerId, 0, 0), "Mining dirt under the cursor should succeed.");

  Inventory *backpack = inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack);
  Require(backpack && backpack->Count() == 3,
          "Mining should grant two non-stackable dirt chunks alongside the equipped shovel.");
}
}

int main()
{
  using TestFn = void (*)();
  const std::vector<std::pair<const char *, TestFn>> tests = {
      {"stage_thresholds_grant_once", &TestStageThresholdsGrantOnce},
      {"multi_threshold_hits_grant_all_new_rewards", &TestMultiThresholdHitsGrantAllNewRewards},
      {"tool_effectiveness", &TestToolEffectiveness},
      {"sparse_override_resolves_without_mutating_base_tile", &TestSparseOverrideResolvesWithoutMutatingBaseTile},
      {"layered_support_uses_destroyed_resolved_tile", &TestLayeredSupportUsesDestroyedResolvedTile},
      {"gold_stackability_and_material_composition", &TestGoldStackabilityAndMaterialComposition},
      {"mine_tile_grants_inventory_loot", &TestMineTileGrantsInventoryLoot},
  };

  try
  {
    for (const auto &[name, test] : tests)
    {
      test();
      std::cout << "[PASS] " << name << '\n';
    }
  }
  catch (const std::exception &ex)
  {
    std::cerr << "[FAIL] " << ex.what() << '\n';
    return 1;
  }

  return 0;
}
