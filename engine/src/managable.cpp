#include "managable.h"

void WithId::ReleaseId(uint32_t id)
{
  _freeList.push_back(id);
}

uint32_t WithId::GenerateId()
{
  if (!_freeList.empty())
  {
    uint32_t recycledId = _freeList.back();
    _freeList.pop_back();
    return recycledId;
  }
  return _nextId++;
}
