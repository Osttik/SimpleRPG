#pragma once
#include "math/point.h"
class GameWorldEngine;

class TransformData
{
private:
  Point _position;
  Point _facingDirection{float32(0), float32(1)};
  GameWorldEngine *_ctx = nullptr;
  uint32_t _ownerId = 0;

  void NotifyDirty();

public:
  const Point &Position() const { return _position; }
  const Point &FacingDirection() const { return _facingDirection; }

  TransformData() = default;
  TransformData(Point position) : _position(position) {}

  void Bind(GameWorldEngine *ctx, uint32_t ownerId)
  {
    _ctx = ctx;
    _ownerId = ownerId;
  }

  void SetPosition(Point newPosition);
  void SetPosition(float32 x, float32 y) { SetPosition(Point(x, y)); }

  void SetZPosition(int32_t positionZ);

  void SetFacing(Point dir);
  void SetFacing(float32 x, float32 y) { SetFacing(Point(x, y)); }
};