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

bool Intersects(Circle *first, Circle *second)
{
  if (PointOperations::DecartLengthMoreThen(first->Center, second->Center, first->Radius + second->Radius))
  {
    return false;
  }

  return true;
}

bool Intersects(Rectangle *first, Rectangle *second)
{
  return (first->BottomRight.X >= second->TopLeft.X &&
           first->TopLeft.X <= second->BottomRight.X &&
           first->BottomRight.Y >= second->TopLeft.Y &&
           first->TopLeft.Y <= second->BottomRight.Y);
}

bool RectOperator::Intersects(Shape *first, Shape *second)
{

  return false;
}
