#include "math/point.h"
#include "math/rect.h"

Point Rectangle::GetCornerPoint(CornerType corner) const
{
  switch (corner)
  {
  case CornerType::TopLeft:
    return this->TopLeft;
  case CornerType::TopRigt:
    return Point(this->BottomRight.X, this->TopLeft.Y);
  case CornerType::BottomLeft:
    return Point(this->TopLeft.X, this->BottomRight.Y);
  case CornerType::BottomRight:
    return this->BottomRight;
  default:
    return Point();
  }
}

Point Circle::GetCornerPoint(CornerType corner) const
{
  switch (corner)
  {
  case CornerType::TopLeft:
    return Point(this->Center.X - this->Radius, this->Center.Y + this->Radius);
  case CornerType::TopRigt:
    return Point(this->Center.X + this->Radius, this->Center.Y + this->Radius);
  case CornerType::BottomLeft:
    return Point(this->Center.X - this->Radius, this->Center.Y - this->Radius);
  case CornerType::BottomRight:
    return Point(this->Center.X + this->Radius, this->Center.Y - this->Radius);
  default:
    return Point();
  }
}

bool Intersect(const Circle &first, const Circle &second)
{
  return !PointOperations::DecartLengthMoreThen(first.Center, second.Center, first.Radius + second.Radius);
}

bool Intersect(const Rectangle &first, const Rectangle &second)
{
  return (first.BottomRight.X >= second.TopLeft.X &&
           first.TopLeft.X <= second.BottomRight.X &&
           first.BottomRight.Y >= second.TopLeft.Y &&
           first.TopLeft.Y <= second.BottomRight.Y);
}

bool Intersect(const Circle &first, const Rectangle &second) {
  float32 closestX = std::max(second.TopLeft.X, std::min(first.Center.X, second.BottomRight.X));
  float32 closestY = std::max(second.TopLeft.Y, std::min(first.Center.Y, second.BottomRight.Y));

  float32 dx = first.Center.X - closestX;
  float32 dy = first.Center.Y - closestY;

  float32 distanceSquared = (dx * dx) + (dy * dy);
  float32 radiusSquared = first.Radius * first.Radius;

  return distanceSquared <= radiusSquared;
}

bool Intersect(const Rectangle &first, const Circle &second) {
  return Intersect(second, first);
}

bool RectOperator::Intersects(const Shape &first, const Shape &second)
{
  if (first.Type == ShapeType::Circle && second.Type == ShapeType::Circle) {
    return Intersect((Circle&)first, (Circle&)second);
  }
  if (first.Type == ShapeType::Rectangle && second.Type == ShapeType::Rectangle) {
    return Intersect((Rectangle&)first, (Rectangle&)second);
  }
  if (first.Type == ShapeType::Circle && second.Type == ShapeType::Rectangle) {
    return Intersect((Circle&)first, (Rectangle&)second);
  }
  return Intersect((Rectangle&)first, (Circle&)second);
}
