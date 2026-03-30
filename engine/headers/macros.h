#pragma once

/**
 * READ_ONLY_COMPONENT(Type, Name)
 * Creates a private storage variable and a public reference alias.
 * Use this for components that should not be REPLACED,
 * but whose internal data can be MODIFIED.
 */
#define READ_ONLY_COMPONENT(Type, Name) \
protected:                                \
  Type _##Name;                         \
                                        \
public:                                 \
  Type &Name = _##Name;

/**
 * READ_ONLY_COMPONENT(Type, Name)
 * Creates a private storage variable and a public reference alias.
 * Use this for components that should not be REPLACED,
 * but whose internal data can be MODIFIED.
 */
#define READ_ONLY_COMPONENT_WITH_DEFAULT_VALUE(Type, Name, Value) \
protected:                                \
  Type _##Name = Value;                         \
                                        \
public:                                 \
  Type &Name = _##Name;