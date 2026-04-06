#include <napi.h>
#include "core/game-world-engine.h"
#include "core/tile-registry.h"
#include "game/entities/player-builder.h"

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
                                              InstanceMethod("getTileRegistry", &GameWorldWrapper::GetTileRegistry),
                                              InstanceMethod("setTileRegistry", &GameWorldWrapper::SetTileRegistry),
                                          });
        exports.Set("GameWorld", func);
        return exports;
    }

    GameWorldWrapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<GameWorldWrapper>(info)
    {
        core_ = std::make_unique<GameWorldEngine>();
    }

private:
    Napi::Value AddPlayer(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
        {
            Napi::TypeError::New(info.Env(), "Requires: x, y").ThrowAsJavaScriptException();
            return info.Env().Null();
        }

        auto spawnPosition = Point(float32(info[0].As<Napi::Number>().DoubleValue()), float32(info[1].As<Napi::Number>().DoubleValue()), 1);
        auto result = PlayerBuilder::Build(*core_, spawnPosition);

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
                def.collide = obj.Has("collide") ? obj.Get("collide").As<Napi::Boolean>().Value() : false;
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
};

Napi::Object InitGameCore(Napi::Env env, Napi::Object exports)
{
    return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, InitGameCore)