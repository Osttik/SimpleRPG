#pragma once
#include "math/point.h"
#include "math/number.h"

enum class CornerType {
  TopLeft,
  TopRigt,
  BottomLeft,
  BottomRight
};

enum class ShapeType {
  None,
  Circle,
  Rectangle
};

struct Shape
{
public:
  const ShapeType Type = ShapeType::None;

  Shape(ShapeType type) : Type(type) {}
  virtual ~Shape() = default;

  virtual Point GetCornerPoint(CornerType corner) const = 0;
};

struct Circle : Shape {
public:
  Point Center;
  float32 Radius;
  Circle(Point center, float32 radius): Shape(ShapeType::Circle), Center(center), Radius(radius) {}
  Point GetCornerPoint(CornerType corner) const override;
};

struct Rectangle : Shape {
public:
  Point TopLeft;
  Point BottomRight;
  Rectangle(Point topLeft, Point bottomRight): Shape(ShapeType::Rectangle), TopLeft(topLeft), BottomRight(bottomRight) {}
  Point GetCornerPoint(CornerType corner) const override;
};

static class RectOperator {
public:
  static bool Intersects(const Shape& first, const Shape& second);
};