#include <fpm/math.hpp>
#include "math/point.h"
#include "math/number.h"


bool PointOperations::DecartLengthMoreThen(Point a, Point b, float32 length) {
  return fpm::pow(fpm::abs(a.X - b.X), 2) + fpm::pow(fpm::abs(a.Y - b.Y), 2) >= fpm::pow(length, 2);
}

Point PointOperations::Add(Point a, Point b) {
  return Point(a.X + b.X, a.Y + b.Y);
}

Point PointOperations::Add(Point a, float32 b) {
  return Point(a.X + b, a.Y + b);
}