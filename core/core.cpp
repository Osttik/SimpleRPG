#include <napi.h>
#include <unordered_map>
#include <memory>
#include <fpm/fixed.hpp>
#include <fpm/math.hpp>
#include "game/game-object-physics.h"
#include "game/game-object.h"
#include "math/rect.h"

using float32 = fpm::fixed_16_16;

/**
 * GameWorldWrapper
 * 
 * N-API wrapper that exposes the C++ physics engine to Node.js.
 * Manages all GameObject instances and the physics simulation.
 */
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
  std::unordered_map<std::string, GameObject*> playerObjects_;   // id -> GameObject*
  std::unordered_map<GameObject*, std::string> playerIds_;       // GameObject* -> id
  std::unordered_map<std::string, float32> playerRadius_;        // id -> radius

  /**
   * addPlayer(id: string, x: number, y: number, radius: number): void
   * 
   * Creates a new player with a circle collider and adds it to the physics system.
   */
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

    // Convert to fixed-point
    float32 fx(x);
    float32 fy(y);
    float32 fradius(radius);

    // Create transform
    Point position(fx, fy);
    TransformData transform(position);

    // Create circle collider
    auto circle = std::make_unique<Circle>(position, fradius);

    // Create GameObject (owned by this wrapper)
    GameObject* obj = new GameObject(transform, std::move(circle));

    // Store mappings
    playerObjects_[id] = obj;
    playerIds_[obj] = id;
    playerRadius_[id] = fradius;

    // Add raw pointer to physics engine (engine does NOT own it)
    physics_->AddObject(obj);

    return env.Undefined();
  }

  /**
   * removePlayer(id: string): void
   * 
   * Removes a player from the physics system and deletes the GameObject.
   */
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
      playerIds_.erase(obj);
      playerRadius_.erase(id);
      playerObjects_.erase(it);
      delete obj;  // Clean up memory
    }

    return env.Undefined();
  }

  /**
   * applyMovement(id: string, dx: number, dy: number, speed: number): void
   * 
   * Applies movement to a player's position.
   */
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

    // Update position
    obj->Transform.Position.X += float32(dx * speed);
    obj->Transform.Position.Y += float32(dy * speed);

    // Update circle collider position
    Circle* circle = dynamic_cast<Circle*>(obj->BoundingBox.get());
    if (circle) {
      circle->Center = obj->Transform.Position;
    }

    // Notify physics engine of update
    physics_->UpdateObject(0);

    return env.Undefined();
  }

  /**
   * tick(): void
   * 
   * Runs one physics simulation step:
   * 1. Query AABB tree for nearby objects
   * 2. Run narrow-phase collision detection
   * 3. Resolve collisions by pushing circles apart
   */
  Napi::Value Tick(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    // Broad phase: get all player pairs and check for collisions
    std::vector<std::pair<GameObject*, GameObject*>> collisions;

    auto playerList = GetAllPlayers();
    
    for (size_t i = 0; i < playerList.size(); ++i) {
      for (size_t j = i + 1; j < playerList.size(); ++j) {
        GameObject* objA = playerList[i];
        GameObject* objB = playerList[j];

        // Both should be circles
        Circle* circleA = dynamic_cast<Circle*>(const_cast<Shape*>(objA->BoundingBox.get()));
        Circle* circleB = dynamic_cast<Circle*>(const_cast<Shape*>(objB->BoundingBox.get()));

        if (!circleA || !circleB) continue;

        // Narrow phase: check distance
        float32 dx = circleB->Center.X - circleA->Center.X;
        float32 dy = circleB->Center.Y - circleA->Center.Y;

        float32 distSquared = dx * dx + dy * dy;
        float32 minDist = circleA->Radius + circleB->Radius;
        float32 minDistSquared = minDist * minDist;

        if (distSquared < minDistSquared) {
          // Collision detected
          collisions.push_back({objA, objB});
        }
      }
    }

    // Resolve collisions
    for (const auto& [objA, objB] : collisions) {
      ResolveCircleCollision(
          const_cast<GameObject*>(objA),
          const_cast<GameObject*>(objB)
      );
    }

    return env.Undefined();
  }

  /**
   * getState(): object
   * 
   * Returns the current state of all players as a JavaScript object.
   * Format: { [id]: { x: number, y: number, radius: number }, ... }
   */
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
  /**
   * Helper: Get all player GameObjects as a vector
   */
  std::vector<GameObject*> GetAllPlayers() const {
    std::vector<GameObject*> result;
    for (const auto& [id, obj] : playerObjects_) {
      result.push_back(obj);
    }
    return result;
  }

  /**
   * ResolveCircleCollision
   * 
   * Resolves a collision between two circles by pushing them apart equally
   * along the collision normal so they no longer intersect.
   */
  void ResolveCircleCollision(GameObject* objA, GameObject* objB) {
    Circle* circleA = dynamic_cast<Circle*>(const_cast<Shape*>(objA->BoundingBox.get()));
    Circle* circleB = dynamic_cast<Circle*>(const_cast<Shape*>(objB->BoundingBox.get()));

    if (!circleA || !circleB) return;

    float32 dx = circleB->Center.X - circleA->Center.X;
    float32 dy = circleB->Center.Y - circleA->Center.Y;

    // Use fpm::sqrt for distance calculation (deterministic)
    float32 distSquared = dx * dx + dy * dy;
    float32 dist = fpm::sqrt(distSquared);

    // Avoid division by zero
    if (dist == float32(0)) {
      dist = float32(0.0001);
    }

    // Normalize the collision vector (normal)
    float32 normalX = dx / dist;
    float32 normalY = dy / dist;

    // Calculate overlap
    float32 minDist = circleA->Radius + circleB->Radius;
    float32 overlap = minDist - dist;

    // Push each circle back by half the overlap
    float32 pushDistance = overlap / float32(2);

    // Update positions
    objA->Transform.Position = Point(
        circleA->Center.X - normalX * pushDistance,
        circleA->Center.Y - normalY * pushDistance
    );
    objB->Transform.Position = Point(
        circleB->Center.X + normalX * pushDistance,
        circleB->Center.Y + normalY * pushDistance
    );

    // Update circle centers
    circleA->Center = objA->Transform.Position;
    circleB->Center = objB->Transform.Position;
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, Init)