#pragma once
#include <memory>
#include <vector>
#include <stdint.h>

class WithId
{
private:
  static inline uint32_t _nextId = 1;
  static inline std::vector<uint32_t> _freeList;

protected:
  static void ReleaseId(uint32_t id);

  static uint32_t GenerateId();

public:
  const uint32_t Id;

  WithId() : Id(GenerateId()) {}

  explicit WithId(uint32_t existingId) : Id(existingId) {}

  virtual ~WithId()
  {
    ReleaseId(Id);
  }

  WithId(const WithId &) = delete;
  WithId &operator=(const WithId &) = delete;
};

class SystemID
{
private:
  static inline uint32_t _nextId = 0;

public:
  template <typename T>
  static uint32_t Get()
  {
    static uint32_t id = _nextId++;
    return id;
  }
};