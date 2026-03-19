#include <napi.h>
#include <unordered_map>
#include <memory>
#include <fpm/fixed.hpp>
#include <fpm/math.hpp>
#include "game/game-object-physics.h"
#include "game/game-object.h"
#include "math/rect.h"
#include "math/number.h"

class GameWorldWrapper : public Napi::ObjectWrap<GameWorldWrapper> {
public:
  static Napi::Function GetClass(Napi::Env env) {
    return DefineClass(env, "GameWorld", {
      InstanceMethod("addPlayer", &GameWorldWrapper::AddPlayer),
      InstanceMethod("removePlayer", &GameWorldWrapper::RemovePlayer),
      InstanceMethod("applyMovement", &GameWorldWrapper::ApplyMovement),
      InstanceMethod("tick", &GameWorldWrapper::Tick),
      InstanceMethod("getState", &GameWorldWrapper::GetState),
    });
  }

  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = GetClass(env);
    exports.Set("GameWorld", func);
    return exports;
  }

  GameWorldWrapper(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<GameWorldWrapper>(info) {
    this->physics_ = std::make_unique<GameObjectPhysics>();
  }

private:
  std::unique_ptr<GameObjectPhysics> physics_;
  std::unordered_map<std::string, GameObject*> playerObjects_;
  std::unordered_map<GameObject*, std::string> playerIds_;
  std::unordered_map<std::string, float32> playerRadius_;
  std::unordered_map<std::string, unsigned int> playerPhysicsIds_;

  Napi::Value AddPlayer(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
      Napi::TypeError::New(env, "addPlayer requires 4 arguments: id, x, y, radius")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();
    double x = info[1].As<Napi::Number>().DoubleValue();
    double y = info[2].As<Napi::Number>().DoubleValue();
    double radius = info[3].As<Napi::Number>().DoubleValue();

    float32 fx(x);
    float32 fy(y);
    float32 fradius(radius);

    Point position(fx, fy);
    TransformData transform(position);

    auto circle = std::make_unique<Circle>(position, fradius);

    GameObject* obj = new GameObject(transform, std::move(circle));

    playerObjects_[id] = obj;
    playerIds_[obj] = id;
    playerRadius_[id] = fradius;

    unsigned int physicsId = physics_->AddObject(obj);
    playerPhysicsIds_[id] = physicsId;

    return env.Undefined();
  }

  Napi::Value RemovePlayer(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
      Napi::TypeError::New(env, "removePlayer requires 1 argument: id")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();

    auto it = playerObjects_.find(id);
    if (it != playerObjects_.end()) {
      GameObject* obj = it->second;

      auto physIt = playerPhysicsIds_.find(id);
      if (physIt != playerPhysicsIds_.end()) {
        physics_->RemoveObject(physIt->second);
        playerPhysicsIds_.erase(physIt);
      }

      playerIds_.erase(obj);
      playerRadius_.erase(id);
      playerObjects_.erase(it);
      delete obj;
    }

    return env.Undefined();
  }

  Napi::Value ApplyMovement(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
      Napi::TypeError::New(env, "applyMovement requires 4 arguments: id, dx, dy, speed")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();
    double dx = info[1].As<Napi::Number>().DoubleValue();
    double dy = info[2].As<Napi::Number>().DoubleValue();
    double speed = info[3].As<Napi::Number>().DoubleValue();

    auto it = playerObjects_.find(id);
    if (it == playerObjects_.end()) {
      return env.Undefined();
    }

    GameObject* obj = it->second;

    obj->Transform.Position.X += float32(dx * speed);
    obj->Transform.Position.Y += float32(dy * speed);

    Circle* circle = dynamic_cast<Circle*>(obj->BoundingBox.get());
    if (circle) {
      circle->Center = obj->Transform.Position;
    }

    auto physIt = playerPhysicsIds_.find(id);
    if (physIt != playerPhysicsIds_.end()) {
      physics_->UpdateObject(physIt->second);
    }

    return env.Undefined();
  }

  Napi::Value Tick(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    std::vector<std::pair<GameObject*, GameObject*>> collisions;

    auto playerList = GetAllPlayers();
    
    for (size_t i = 0; i < playerList.size(); ++i) {
      for (size_t j = i + 1; j < playerList.size(); ++j) {
        GameObject* objA = playerList[i];
        GameObject* objB = playerList[j];

        Circle* circleA = dynamic_cast<Circle*>(const_cast<Shape*>(objA->BoundingBox.get()));
        Circle* circleB = dynamic_cast<Circle*>(const_cast<Shape*>(objB->BoundingBox.get()));

        if (!circleA || !circleB) continue;

        float32 dx = circleB->Center.X - circleA->Center.X;
        float32 dy = circleB->Center.Y - circleA->Center.Y;
        float32 minDist = circleA->Radius + circleB->Radius;

        float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
        float32 absDy = dy < float32(0) ? float32(0) - dy : dy;
        if (absDx > minDist || absDy > minDist) continue;

        float32 distSquared = dx * dx + dy * dy;
        float32 minDistSquared = minDist * minDist;

        if (distSquared < minDistSquared) {
          collisions.push_back({objA, objB});
        }
      }
    }

    for (const auto& [objA, objB] : collisions) {
      ResolveCircleCollision(
          const_cast<GameObject*>(objA),
          const_cast<GameObject*>(objB)
      );
    }

    return env.Undefined();
  }

  Napi::Value GetState(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    Napi::Object state = Napi::Object::New(env);

    for (const auto& [id, obj] : playerObjects_) {
      Napi::Object playerData = Napi::Object::New(env);

      double x = static_cast<double>(obj->Transform.Position.X);
      double y = static_cast<double>(obj->Transform.Position.Y);
      double radius = static_cast<double>(playerRadius_[id]);

      playerData.Set("x", Napi::Number::New(env, x));
      playerData.Set("y", Napi::Number::New(env, y));
      playerData.Set("radius", Napi::Number::New(env, radius));

      state.Set(id, playerData);
    }

    return state;
  }

private:
  std::vector<GameObject*> GetAllPlayers() const {
    std::vector<GameObject*> result;
    for (const auto& [id, obj] : playerObjects_) {
      result.push_back(obj);
    }
    return result;
  }

  void ResolveCircleCollision(GameObject* objA, GameObject* objB) {
    Circle* circleA = dynamic_cast<Circle*>(const_cast<Shape*>(objA->BoundingBox.get()));
    Circle* circleB = dynamic_cast<Circle*>(const_cast<Shape*>(objB->BoundingBox.get()));

    if (!circleA || !circleB) return;

    float32 dx = circleB->Center.X - circleA->Center.X;
    float32 dy = circleB->Center.Y - circleA->Center.Y;
    float32 minDist = circleA->Radius + circleB->Radius;

    float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
    float32 absDy = dy < float32(0) ? float32(0) - dy : dy;
    if (absDx > minDist || absDy > minDist) return;

    float32 distSquared = dx * dx + dy * dy;
    float32 dist = fpm::sqrt(distSquared);

    if (dist == float32(0)) {
      dist = float32(0.0001);
    }

    float32 normalX = dx / dist;
    float32 normalY = dy / dist;

    float32 overlap = minDist - dist;

    float32 pushDistance = overlap / float32(2);

    objA->Transform.Position = Point(
        circleA->Center.X - normalX * pushDistance,
        circleA->Center.Y - normalY * pushDistance
    );
    objB->Transform.Position = Point(
        circleB->Center.X + normalX * pushDistance,
        circleB->Center.Y + normalY * pushDistance
    );

    circleA->Center = objA->Transform.Position;
    circleB->Center = objB->Transform.Position;
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, Init)