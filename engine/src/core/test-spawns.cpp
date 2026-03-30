#include "core/test-spawns.h"
#include "core/game-object/game-object.h"
#include "core/inventory.h"

void SpawnTestChests(GameWorldEngine& core) {
    float32 fwidth(32.0), fheight(32.0);

    auto spawnChest = [&](float32 fx, float32 fy) {
        Point position(fx, fy);
        Point topLeft(float32(fx - fwidth / float32(2.0)), float32(fy - fheight / float32(2.0)));
        Point bottomRight(float32(fx + fwidth / float32(2.0)), float32(fy + fheight / float32(2.0)));
        auto rect = std::make_unique<Rectangle>(topLeft, bottomRight);

        // Use ObjectManager to create — it handles physics registration, context binding, and dirty marking
        GameObject* chest = core.ObjectManager.CreateChest(position, std::move(rect), float32(32.0), 1);

        // Add items to the chest's MainStorage
        Inventory* mainStorage = chest->Inventories->GetContainer(ContainerSlot::MainStorage);
        if (mainStorage) {
            mainStorage->AddItem(std::make_unique<Coin>(1000));
            for (int i = 0; i < 5; i++) {
                mainStorage->AddItem(std::make_unique<Sword>());
            }
        }
    };

    spawnChest(float32(500.0), float32(500.0));
    spawnChest(float32(450.0), float32(500.0));
}
