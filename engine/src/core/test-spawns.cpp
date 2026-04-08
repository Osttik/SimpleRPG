#include "core/test-spawns.h"
#include "core/inventory.h"
#include "core/components/inventory-component.h"

void SpawnTestChests(GameWorldEngine &core)
{
    auto spawnChest = [&](float32 fx, float32 fy)
    {
        Point position(fx, fy);
        uint32_t id = core.Props.AddChest(core, position, float32(32.0), 1);

        auto *invMgr = core.Ctx.GetManager<InventoryComponentManager>();
        if (invMgr)
        {
            Inventory *mainStorage = invMgr->GetContainer(id, ContainerSlot::MainStorage);
            if (mainStorage)
            {
                mainStorage->AddItem(std::make_unique<Coin>(1000));
                for (int i = 0; i < 5; i++)
                {
                    mainStorage->AddItem(std::make_unique<Sword>());
                }
            }
        }
    };

    spawnChest(float32(500.0), float32(500.0));
    spawnChest(float32(450.0), float32(500.0));
}
