#include "game/test-spawns.h"
#include "game/game-object.h"
#include "game/inventory.h"

void SpawnTestChests(GameCore& core) {
  float32 fwidth(32.0), fheight(32.0);
  
  auto spawnChest = [&](const std::string& id, float32 fx, float32 fy) {
    Point position(fx, fy);
    Point topLeft(float32(fx - fwidth/float32(2.0)), float32(fy - fheight/float32(2.0)));
    Point bottomRight(float32(fx + fwidth/float32(2.0)), float32(fy + fheight/float32(2.0)));
    auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);
    
    auto chestObj = std::make_unique<Chest>(TransformData(position), std::move(rect));
    chestObj->IsStaticProp = true;
    chestObj->ChunkZ = 1;
    chestObj->Id = id;
    
    Inventory* mainStorage = chestObj->Inventories->GetContainer(ContainerSlot::MainStorage);
    if (mainStorage) {
      mainStorage->AddItem(std::make_unique<Coin>(1000));
      for (int i = 0; i < 5; i++) {
        mainStorage->AddItem(std::make_unique<Sword>());
      }
    }

    unsigned int physId = core.Physics.AddObject(chestObj.get());
    chestObj->PhysicsId = physId;

    core.World.Props[id] = EntityRecord{std::move(chestObj), physId, float32(32.0)};
  };

  spawnChest("test_chest_0", float32(500.0), float32(500.0));
  spawnChest("test_chest_1", float32(550.0), float32(500.0));
}
