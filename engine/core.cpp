#include <napi.h>
#include "core/game-world-engine.h"
#include "core/tile-registry.h"
#include "core/components/dropped-item-component.h"
#include "core/components/equipment-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"

class GameWorldWrapper : public Napi::ObjectWrap<GameWorldWrapper>
{
private:
    std::unique_ptr<GameWorldEngine> core_;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "GameWorld",
                                          {
                                              InstanceMethod("addPlayer", &GameWorldWrapper::AddPlayer),
                                              InstanceMethod("removePlayer", &GameWorldWrapper::RemovePlayer),
                                              InstanceMethod("addProp", &GameWorldWrapper::AddProp),
                                              InstanceMethod("destroyProp", &GameWorldWrapper::DestroyProp),
                                              InstanceMethod("destroyTile", &GameWorldWrapper::DestroyTile),
                                              InstanceMethod("processInput", &GameWorldWrapper::ProcessInput),
                                              InstanceMethod("spawnTestChest", &GameWorldWrapper::SpawnTestChest),
                                              InstanceMethod("tick", &GameWorldWrapper::Tick),
                                              InstanceMethod("getChunk", &GameWorldWrapper::GetChunk),
                                              InstanceMethod("getChunkVisuals", &GameWorldWrapper::GetChunkVisuals),
                                              InstanceMethod("getState", &GameWorldWrapper::GetState),
                                              InstanceMethod("getBinaryState", &GameWorldWrapper::GetBinaryState),
                                              InstanceMethod("getCombatEvents", &GameWorldWrapper::GetCombatEvents),
                                              InstanceMethod("getTileRegistry", &GameWorldWrapper::GetTileRegistry),
                                              InstanceMethod("setTileRegistry", &GameWorldWrapper::SetTileRegistry),
                                              InstanceMethod("getInteractionOptions", &GameWorldWrapper::GetInteractionOptions),
                                              InstanceMethod("interactTarget", &GameWorldWrapper::InteractTarget),
                                              InstanceMethod("getLootState", &GameWorldWrapper::GetLootState),
                                              InstanceMethod("getPlayerInventoryState", &GameWorldWrapper::GetPlayerInventoryState),
                                              InstanceMethod("transferItem", &GameWorldWrapper::TransferItem),
                                              InstanceMethod("toggleEquipItem", &GameWorldWrapper::ToggleEquipItem),
                                              InstanceMethod("dropItem", &GameWorldWrapper::DropItem),
                                              InstanceMethod("getBodyStateManifest", &GameWorldWrapper::GetBodyStateManifest),
                                              InstanceMethod("getEntityBodyState", &GameWorldWrapper::GetEntityBodyState),
                                              InstanceMethod("setLayerDebugEnabled", &GameWorldWrapper::SetLayerDebugEnabled),
                                              InstanceMethod("getLayerDebugState", &GameWorldWrapper::GetLayerDebugState),
                                              InstanceMethod("getLayerValidationIssues", &GameWorldWrapper::GetLayerValidationIssues),
                                          });
        exports.Set("GameWorld", func);
        return exports;
    }

    GameWorldWrapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<GameWorldWrapper>(info)
    {
        core_ = std::make_unique<GameWorldEngine>();
    }

private:
    bool GetBool(const Napi::Object &obj, const char *name, bool fallback) const
    {
        if (!obj.Has(name))
            return fallback;
        Napi::Value value = obj.Get(name);
        return value.IsBoolean() ? value.As<Napi::Boolean>().Value() : fallback;
    }

    int32_t GetInt(const Napi::Object &obj, const char *name, int32_t fallback) const
    {
        if (!obj.Has(name))
            return fallback;
        Napi::Value value = obj.Get(name);
        return value.IsNumber() ? value.As<Napi::Number>().Int32Value() : fallback;
    }

    TileConnectorType ParseConnectorType(const std::string &value) const
    {
        if (value == "ladder")
            return TileConnectorType::Ladder;
        if (value == "stairs")
            return TileConnectorType::Stairs;
        if (value == "hatch")
            return TileConnectorType::Hatch;
        if (value == "drop")
            return TileConnectorType::Drop;
        return TileConnectorType::None;
    }

    TileConnectorDef ParseConnector(const Napi::Object &obj, const TileConnectorDef &fallback) const
    {
        TileConnectorDef connector = fallback;
        if (obj.Has("type") && obj.Get("type").IsString())
            connector.Type = ParseConnectorType(obj.Get("type").As<Napi::String>().Utf8Value());

        connector.DeltaZ = static_cast<int8_t>(GetInt(obj, "deltaZ", connector.DeltaZ));
        connector.AllowedEnterDirectionMask = static_cast<uint8_t>(GetInt(obj, "allowedEnterDirectionMask", connector.AllowedEnterDirectionMask));
        connector.AllowedMovementDirectionMask = static_cast<uint8_t>(GetInt(obj, "allowedMovementDirectionMask", connector.AllowedMovementDirectionMask));
        connector.AutoTrigger = GetBool(obj, "autoTrigger", connector.AutoTrigger);
        connector.RequireDestinationSupport = GetBool(obj, "requireDestinationSupport", connector.RequireDestinationSupport);
        connector.RequireDestinationNotBlocked = GetBool(obj, "requireDestinationNotBlocked", connector.RequireDestinationNotBlocked);
        connector.CooldownTicks = static_cast<uint8_t>(GetInt(obj, "cooldownTicks", connector.CooldownTicks));
        connector.OneWay = GetBool(obj, "oneWay", connector.OneWay);
        connector.Bidirectional = GetBool(obj, "bidirectional", connector.Bidirectional);

        if (obj.Has("triggerBounds") && obj.Get("triggerBounds").IsObject())
        {
            Napi::Object bounds = obj.Get("triggerBounds").As<Napi::Object>();
            connector.TriggerMinX = static_cast<int16_t>(GetInt(bounds, "minX", connector.TriggerMinX));
            connector.TriggerMinY = static_cast<int16_t>(GetInt(bounds, "minY", connector.TriggerMinY));
            connector.TriggerMaxX = static_cast<int16_t>(GetInt(bounds, "maxX", connector.TriggerMaxX));
            connector.TriggerMaxY = static_cast<int16_t>(GetInt(bounds, "maxY", connector.TriggerMaxY));
        }

        return connector;
    }

    TileGameplayDef ParseTileGameplay(const Napi::Object &obj) const
    {
        TileGameplayDef gameplay;
        const bool collide = GetBool(obj, "collide", false);
        gameplay.Collide = collide;
        gameplay.Support = GetBool(obj, "support", !collide);
        gameplay.FallThrough = GetBool(obj, "fallThrough", !gameplay.Support);
        gameplay.Roof = GetBool(obj, "roof", false);
        gameplay.Occludes = GetBool(obj, "occludes", collide || gameplay.Roof);

        if (obj.Has("connector") && obj.Get("connector").IsObject())
            gameplay.Connector = ParseConnector(obj.Get("connector").As<Napi::Object>(), gameplay.Connector);

        return gameplay;
    }

    Napi::Object BuildInventoryObject(Napi::Env env, uint32_t ownerId, Inventory *inventory) const
    {
        Napi::Object out = Napi::Object::New(env);
        Napi::Array items = Napi::Array::New(env);
        auto *equipmentMgr = core_->Ctx.GetManager<EquipmentComponentManager>();

        if (inventory)
        {
            for (size_t i = 0; i < inventory->Count(); ++i)
            {
                const Item *item = (*inventory)[i];
                if (!item)
                    continue;

                Napi::Object row = Napi::Object::New(env);
                row.Set("id", Napi::String::New(env, std::to_string(i)));
                row.Set("name", Napi::String::New(env, item->Name));
                row.Set("spriteKey", Napi::String::New(env, item->SpriteKey));
                row.Set("quantity", Napi::Number::New(env, item->Quantity));
                row.Set("stackable", Napi::Boolean::New(env, item->Stackable));
                row.Set("maxStack", Napi::Number::New(env, item->MaxStack));
                row.Set("volume", Napi::Number::New(env, static_cast<double>(item->Volume)));
                row.Set("weight", Napi::Number::New(env, static_cast<double>(item->Weight)));
                row.Set("price", Napi::Number::New(env, static_cast<double>(item->GetMerchantBaseValue())));
                const bool equipped = equipmentMgr ? equipmentMgr->IsEquipped(ownerId, item) : false;
                row.Set("equipped", Napi::Boolean::New(env, equipped));
                const auto slot = equipmentMgr ? equipmentMgr->GetEquippedSlotFor(ownerId, item) : EquipSlot::None;
                row.Set("equipSlot", Napi::String::New(env, EquipmentComponentManager::SlotName(slot)));
                items.Set(i, row);
            }

            out.Set("currentVolume", Napi::Number::New(env, static_cast<double>(inventory->GetCurrentVolume())));
            out.Set("maxVolume", Napi::Number::New(env, static_cast<double>(inventory->MaxCarryVolume)));
            out.Set("currentWeight", Napi::Number::New(env, static_cast<double>(inventory->GetAllWeight())));
        }
        else
        {
            out.Set("currentVolume", Napi::Number::New(env, 0.0));
            out.Set("maxVolume", Napi::Number::New(env, 0.0));
            out.Set("currentWeight", Napi::Number::New(env, 0.0));
        }

        out.Set("items", items);
        return out;
    }

    Napi::Value BuildPlayerInventoryState(Napi::Env env, uint32_t playerId) const
    {
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (!inventoryMgr)
            return env.Null();

        Napi::Object payload = Napi::Object::New(env);
        auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
        payload.Set("playerInventory", playerInventory.Get("items"));
        payload.Set("playerInventoryMeta", playerInventory);
        return payload;
    }

    Napi::Value BuildLootState(Napi::Env env, uint32_t playerId, uint32_t targetId) const
    {
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (!interactMgr || !inventoryMgr)
            return env.Null();

        auto *player = core_->ObjectManager.GetById(playerId);
        auto *target = core_->ObjectManager.GetById(targetId);
        if (!player || !target || !interactMgr->CanInteract(playerId, targetId))
            return env.Null();

        auto *interactComp = interactMgr->Get(targetId);
        if (interactComp && interactComp->Type == InteractionType::Pickup)
        {
            if (!core_->PickupItem(playerId, targetId))
                return env.Null();

            Napi::Object payload = Napi::Object::New(env);
            payload.Set("payloadType", Napi::String::New(env, "player_inventory"));
            auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
            payload.Set("playerInventory", playerInventory.Get("items"));
            payload.Set("playerInventoryMeta", playerInventory);
            return payload;
        }

        Napi::Object payload = Napi::Object::New(env);
        payload.Set("chestId", Napi::String::New(env, std::to_string(targetId)));
        payload.Set("interactionType", Napi::String::New(env, "loot"));

        auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
        auto chestInventory = BuildInventoryObject(env, targetId, inventoryMgr->GetContainer(targetId, ContainerSlot::MainStorage));

        payload.Set("playerInventory", playerInventory.Get("items"));
        payload.Set("chestInventory", chestInventory.Get("items"));
        payload.Set("playerInventoryMeta", playerInventory);
        payload.Set("chestInventoryMeta", chestInventory);
        return payload;
    }

    Napi::Value AddPlayer(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
        {
            Napi::TypeError::New(info.Env(), "Requires: x, y").ThrowAsJavaScriptException();
            return info.Env().Null();
        }

        auto spawnPosition = Point(float32(info[0].As<Napi::Number>().DoubleValue()), float32(info[1].As<Napi::Number>().DoubleValue()), 1);
        auto result = core_->Players.AddPlayer(*core_, spawnPosition);

        return Napi::Number::New(info.Env(), result);
    }

    Napi::Value RemovePlayer(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1)
        {
            return info.Env().Null();
        }

        core_->RemovePlayer(info[0].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value AddProp(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 4)
        {
            return info.Env().Null();
        }

        auto result = core_->AddProp(
            info[0].As<Napi::Number>().DoubleValue(),
            info[1].As<Napi::Number>().DoubleValue(),
            info[2].As<Napi::Number>().DoubleValue(),
            info[3].As<Napi::Number>().Int32Value());

        return Napi::Number::New(info.Env(), result);
    }

    Napi::Value DestroyProp(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1)
        {
            return info.Env().Null();
        }

        core_->DestroyProp(info[0].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value DestroyTile(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        core_->DestroyTile(
            info[0].As<Napi::Number>().Int32Value(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value SpawnTestChest(const Napi::CallbackInfo &info)
    {
        core_->SpawnTestChest();
        return info.Env().Undefined();
    }

    Napi::Value ProcessInput(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || (!info[1].IsBuffer() && !info[1].IsArrayBuffer() && !info[1].IsTypedArray()))
            return info.Env().Null();

        uint32_t id = info[0].As<Napi::Number>().Int32Value();
        const uint8_t *data = nullptr;
        size_t length = 0;

        if (info[1].IsBuffer())
        {
            Napi::Buffer<uint8_t> buf = info[1].As<Napi::Buffer<uint8_t>>();
            data = buf.Data();
            length = buf.Length();
        }
        else if (info[1].IsArrayBuffer())
        {
            Napi::ArrayBuffer ab = info[1].As<Napi::ArrayBuffer>();
            data = static_cast<const uint8_t *>(ab.Data());
            length = ab.ByteLength();
        }
        else if (info[1].IsTypedArray())
        {
            Napi::TypedArray ab = info[1].As<Napi::TypedArray>();
            data = static_cast<const uint8_t *>(ab.ArrayBuffer().Data()) + ab.ByteOffset();
            length = ab.ByteLength();
        }

        core_->ProcessInput(id, data, length);

        return info.Env().Undefined();
    }

    Napi::Value Tick(const Napi::CallbackInfo &info)
    {
        core_->Tick();
        return info.Env().Undefined();
    }

    Napi::Value GetInteractionOptions(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        auto *player = core_->ObjectManager.GetById(playerId);
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        if (!player || !interactMgr)
            return info.Env().Null();

        Napi::Array targets = Napi::Array::New(info.Env());
        uint32_t index = 0;

        for (const auto &[id, entity] : core_->ObjectManager.GetEntities())
        {
            if (id == playerId)
                continue;
            if (!interactMgr->IsInteractable(id))
                continue;
            if (!interactMgr->CanInteract(playerId, id))
                continue;

            auto *comp = interactMgr->Get(id);
            if (!comp)
                continue;

            if (comp->Type == InteractionType::Pickup)
            {
                auto *droppedMgr = core_->Ctx.GetManager<DroppedItemComponentManager>();
                auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
                auto *backpack = inventoryMgr ? inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack) : nullptr;
                auto *item = droppedMgr ? droppedMgr->GetItem(id) : nullptr;
                if (!backpack || !item || !backpack->CanAccept(*item))
                    continue;
            }
            else if (comp->Type != InteractionType::Loot)
            {
                continue;
            }
            Napi::Object target = Napi::Object::New(info.Env());
            target.Set("targetId", Napi::String::New(info.Env(), std::to_string(id)));
            const std::string baseLabel = comp && !comp->Label.empty() ? comp->Label : entity->Type;
            target.Set("nameKey", Napi::String::New(info.Env(), baseLabel + " #" + std::to_string(id)));

            Napi::Array interactions = Napi::Array::New(info.Env(), 1);
            Napi::Object option = Napi::Object::New(info.Env());
            option.Set("interactionId", Napi::String::New(info.Env(), comp->Type == InteractionType::Pickup ? "pickup" : "loot"));
            option.Set("nameKey", Napi::String::New(info.Env(), comp->Type == InteractionType::Pickup ? "Pick up" : "Loot"));
            interactions.Set(uint32_t(0), option);
            target.Set("interactions", interactions);

            targets.Set(index++, target);
        }

        Napi::Object result = Napi::Object::New(info.Env());
        result.Set("targets", targets);
        result.Set("selectedTargetId", Napi::String::New(info.Env(), std::to_string(player->FocusedObjectId)));
        return result;
    }

    Napi::Value InteractTarget(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();

        auto *player = core_->ObjectManager.GetById(playerId);
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        if (!player || !interactMgr)
            return info.Env().Null();

        if (targetId == 0)
            targetId = player->FocusedObjectId;

        if (!interactMgr->CanInteract(playerId, targetId))
            return info.Env().Null();

        player->FocusedObjectId = targetId;
        core_->Interact(playerId);

        return BuildLootState(info.Env(), playerId, targetId);
    }

    Napi::Value GetLootState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        const uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();
        return BuildLootState(info.Env(), playerId, targetId);
    }

    Napi::Value GetPlayerInventoryState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        return BuildPlayerInventoryState(info.Env(), info[0].As<Napi::Number>().Uint32Value());
    }

    Napi::Value TransferItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 5)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        const uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();
        const int from = info[2].As<Napi::Number>().Int32Value();
        const int to = info[3].As<Napi::Number>().Int32Value();
        const int idx = info[4].As<Napi::Number>().Int32Value();

        return Napi::Boolean::New(info.Env(), core_->TransferItem(playerId, targetId, from, to, idx));
    }

    Napi::Value ToggleEquipItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const int idx = info[1].As<Napi::Number>().Int32Value();
        return Napi::Boolean::New(info.Env(), core_->ToggleEquipItem(entityId, idx));
    }

    Napi::Value DropItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const int idx = info[1].As<Napi::Number>().Int32Value();
        return Napi::Boolean::New(info.Env(), core_->DropItem(entityId, idx));
    }

    // ─── Zero-Copy Binary State ───
    Napi::Value GetBinaryState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        core_->SerializeSnapshot();
        core_->Snapshot.Swap();

        const uint8_t *readBuf = core_->Snapshot.GetReadBuffer();
        size_t payloadSize = core_->Snapshot.GetReadPayloadSize();

        auto ab = Napi::ArrayBuffer::New(
            env,
            const_cast<uint8_t *>(readBuf),
            payloadSize,
            [](Napi::Env, void *) {} // no-op release: C++ owns the memory
        );

        return ab;
    }

    Napi::Value GetCombatEvents(const Napi::CallbackInfo &info)
    {
        if (core_->CombatEvents.Empty())
        {
            return info.Env().Null();
        }

        const auto bytes = core_->CombatEvents.SerializeAndClear();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value GetChunk(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        Chunk *chunk = core_->World.GetChunkSafely(
            info[0].As<Napi::Number>().Int32Value(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value());
        if (!chunk)
            return info.Env().Null();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), reinterpret_cast<uint8_t *>(chunk->tiles), CHUNK_VOLUME * sizeof(uint16_t));
    }

    Napi::Value GetChunkVisuals(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        Chunk *chunk = core_->World.GetChunkSafely(
            info[0].As<Napi::Number>().Int32Value(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value());
        if (!chunk)
            return info.Env().Null();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), reinterpret_cast<uint8_t *>(chunk->visual_mask_layer), CHUNK_VOLUME * sizeof(uint8_t));
    }

    Napi::Value SetTileRegistry(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsArray())
            return info.Env().Null();
        Napi::Array arr = info[0].As<Napi::Array>();
        std::vector<TileDef> definitions;

        for (uint32_t i = 0; i < arr.Length(); i++)
        {
            Napi::Value val = arr[i];
            if (val.IsObject())
            {
                Napi::Object obj = val.As<Napi::Object>();
                TileDef def;
                def.id = obj.Get("id").As<Napi::Number>().Uint32Value();
                def.name = obj.Get("name").As<Napi::String>().Utf8Value();
                def.gameplay = ParseTileGameplay(obj);
                definitions.push_back(def);
            }
        }
        core_->SetTileRegistry(definitions);
        return info.Env().Undefined();
    }

    Napi::Value GetTileRegistry(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        auto map = TileRegistry::GetAllTiles();
        Napi::Object obj = Napi::Object::New(env);
        for (const auto &[id, name] : map)
        {
            obj.Set(std::to_string(id), Napi::String::New(env, name));
        }
        return obj;
    }

    Napi::Value GetState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        Napi::Object state = Napi::Object::New(env);
        Napi::Object players = Napi::Object::New(env);
        Napi::Array destroyed = Napi::Array::New(env);

        // Iterate all entities from ObjectManager
        for (const auto &[numId, entity] : core_->ObjectManager.GetEntities())
        {
            Napi::Object pData = Napi::Object::New(env);
            pData.Set("x", Napi::Number::New(env, static_cast<double>(entity->Transform.Position().X)));
            pData.Set("y", Napi::Number::New(env, static_cast<double>(entity->Transform.Position().Y)));
            pData.Set("radius", Napi::Number::New(env, static_cast<double>(entity->Radius)));
            pData.Set("z", Napi::Number::New(env, entity->Transform.Position().Z));
            pData.Set("type", Napi::String::New(env, entity->Type));

            // Resolve focusedId for players
            if (!entity->IsStaticProp && entity->FocusedObjectId != 0)
            {
                pData.Set("focusedId", Napi::Number::New(env, entity->FocusedObjectId));
            }

            players.Set(numId, pData);
        }

        // Populate Destroyed array
        const auto &recentlyDestroyed = core_->ObjectManager.GetRecentlyDestroyed();
        for (size_t i = 0; i < recentlyDestroyed.size(); ++i)
        {
            destroyed.Set(i, Napi::Number::New(env, recentlyDestroyed[i]));
        }

        state.Set("players", players);
        state.Set("destroyed", destroyed);
        return state;
    }

    Napi::Value GetBodyStateManifest(const Napi::CallbackInfo &info)
    {
        const auto bytes = core_->SerializeBodyStateManifest();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value GetEntityBodyState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const auto bytes = core_->SerializeEntityBodyState(entityId);
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value SetLayerDebugEnabled(const Napi::CallbackInfo &info)
    {
        const bool enabled = info.Length() > 0 && info[0].IsBoolean() && info[0].As<Napi::Boolean>().Value();
        core_->Layers.SetDebugEnabled(enabled);
        return info.Env().Undefined();
    }

    Napi::Value GetLayerDebugState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const WorldLayerDebugState *debug = core_->Layers.GetDebugState(entityId);
        if (!debug)
            return info.Env().Null();

        Napi::Env env = info.Env();
        Napi::Object out = Napi::Object::New(env);
        out.Set("tick", Napi::Number::New(env, debug->Tick));
        out.Set("entityId", Napi::Number::New(env, debug->EntityId));
        out.Set("sourceZ", Napi::Number::New(env, debug->SourceZ));
        out.Set("resolvedZ", Napi::Number::New(env, debug->ResolvedZ));
        out.Set("transitioned", Napi::Boolean::New(env, debug->Transitioned));
        out.Set("fell", Napi::Boolean::New(env, debug->Fell));
        out.Set("phase", Napi::String::New(env, debug->Phase));
        out.Set("reason", Napi::String::New(env, debug->Reason));

        Napi::Array samples = Napi::Array::New(env, debug->SupportSamples.size());
        for (uint32_t i = 0; i < debug->SupportSamples.size(); ++i)
        {
            const auto &sample = debug->SupportSamples[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("tileX", Napi::Number::New(env, sample.TileX));
            row.Set("tileY", Napi::Number::New(env, sample.TileY));
            row.Set("z", Napi::Number::New(env, sample.Z));
            row.Set("tileId", Napi::Number::New(env, sample.TileId));
            row.Set("support", Napi::Boolean::New(env, sample.Support));
            row.Set("fallThrough", Napi::Boolean::New(env, sample.FallThrough));
            row.Set("blocked", Napi::Boolean::New(env, sample.Blocked));
            samples.Set(i, row);
        }
        out.Set("supportSamples", samples);

        Napi::Array connectors = Napi::Array::New(env, debug->ConnectorCandidates.size());
        for (uint32_t i = 0; i < debug->ConnectorCandidates.size(); ++i)
        {
            const auto &candidate = debug->ConnectorCandidates[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("tileX", Napi::Number::New(env, candidate.TileX));
            row.Set("tileY", Napi::Number::New(env, candidate.TileY));
            row.Set("sourceZ", Napi::Number::New(env, candidate.SourceZ));
            row.Set("destinationZ", Napi::Number::New(env, candidate.DestinationZ));
            row.Set("type", Napi::Number::New(env, static_cast<uint8_t>(candidate.Type)));
            row.Set("triggerMinX", Napi::Number::New(env, candidate.TriggerMinX));
            row.Set("triggerMinY", Napi::Number::New(env, candidate.TriggerMinY));
            row.Set("triggerMaxX", Napi::Number::New(env, candidate.TriggerMaxX));
            row.Set("triggerMaxY", Napi::Number::New(env, candidate.TriggerMaxY));
            row.Set("allowedEnterDirectionMask", Napi::Number::New(env, candidate.AllowedEnterDirectionMask));
            row.Set("allowedMovementDirectionMask", Napi::Number::New(env, candidate.AllowedMovementDirectionMask));
            row.Set("triggerHit", Napi::Boolean::New(env, candidate.TriggerHit));
            row.Set("directionAllowed", Napi::Boolean::New(env, candidate.DirectionAllowed));
            row.Set("destinationSupportOk", Napi::Boolean::New(env, candidate.DestinationSupportOk));
            row.Set("destinationBlockedOk", Napi::Boolean::New(env, candidate.DestinationBlockedOk));
            row.Set("selected", Napi::Boolean::New(env, candidate.Selected));
            row.Set("accepted", Napi::Boolean::New(env, candidate.Accepted));
            row.Set("rejectionReason", Napi::String::New(env, candidate.RejectionReason));
            connectors.Set(i, row);
        }
        out.Set("connectorCandidates", connectors);

        Napi::Array landings = Napi::Array::New(env, debug->LandingCandidates.size());
        for (uint32_t i = 0; i < debug->LandingCandidates.size(); ++i)
        {
            const auto &candidate = debug->LandingCandidates[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("candidateZ", Napi::Number::New(env, candidate.CandidateZ));
            row.Set("supportOk", Napi::Boolean::New(env, candidate.SupportOk));
            row.Set("blocked", Napi::Boolean::New(env, candidate.Blocked));
            row.Set("accepted", Napi::Boolean::New(env, candidate.Accepted));
            landings.Set(i, row);
        }
        out.Set("landingCandidates", landings);

        return out;
    }

    Napi::Value GetLayerValidationIssues(const Napi::CallbackInfo &info)
    {
        const auto issues = core_->Layers.ValidateLoadedWorld(*core_->World.ChunkManager);
        Napi::Array result = Napi::Array::New(info.Env(), issues.size());
        for (uint32_t i = 0; i < issues.size(); ++i)
        {
            const auto &issue = issues[i];
            Napi::Object row = Napi::Object::New(info.Env());
            row.Set("tileX", Napi::Number::New(info.Env(), issue.TileX));
            row.Set("tileY", Napi::Number::New(info.Env(), issue.TileY));
            row.Set("tileZ", Napi::Number::New(info.Env(), issue.TileZ));
            row.Set("code", Napi::String::New(info.Env(), issue.Code));
            row.Set("message", Napi::String::New(info.Env(), issue.Message));
            result.Set(i, row);
        }
        return result;
    }
};

Napi::Object InitGameCore(Napi::Env env, Napi::Object exports)
{
    return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, InitGameCore)
