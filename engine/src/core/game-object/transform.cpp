#include "core/game-object/transform.h"
#include "core/game-context.h"
#include "core/game-object/game-object-manager.h"
#include "core/game-world-engine.h"

void TransformData::NotifyDirty() {
    if (_ctx)
        _ctx->ObjectManager.OnTransformStateChanged(_ownerId);
}

void TransformData::SetPosition(Point newPosition) {
    Point previous = _position;
    _position = newPosition;
    if (_ctx)
        _ctx->ObjectManager.OnTransformPositionChanged(_ownerId, previous, newPosition);
}

void TransformData::SetFacing(Point dir) {
    _facingDirection = dir;
    NotifyDirty();
}

void TransformData::SetZPosition(int32_t positionZ) {
    SetPosition(Point(_position.X, _position.Y, positionZ));
}
