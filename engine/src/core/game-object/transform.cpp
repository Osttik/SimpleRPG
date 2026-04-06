#include "core/game-object/transform.h"
#include "core/game-context.h"
#include "core/game-object/game-object-manager.h"
#include "core/game-world-engine.h"

void TransformData::NotifyDirty() {
    _ctx->ObjectManager.MarkDirty(_ownerId);
}

void TransformData::SetPosition(Point newPosition) {
    _position = newPosition;
    NotifyDirty();
}

void TransformData::SetFacing(Point dir) {
    _facingDirection = dir;
    NotifyDirty();
}

void TransformData::SetZPosition(int32_t positionZ) {
    _position = Point(_position.X, _position.Y, positionZ);
    NotifyDirty();
}
