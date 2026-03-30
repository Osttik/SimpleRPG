#pragma once
#include <string>
#include "macros.h"
#include "managable.h"
#include "core/game-world-engine.h"

class UserConnection : public WithId {
public:
  READ_ONLY_COMPONENT(GameWorldEngine*, WorldEngine)
};