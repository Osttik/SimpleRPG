#pragma once
#include"math/number.h"

struct Point {
public:
  float32 X;
  float32 Y;

  Point(): X(0), Y(0) {}
  Point(float32 x, float32 y): X(x), Y(y) {}
};

class PointOperations {
public:
  static bool DecartLengthMoreThen(Point a, Point b, float32 length);
  static Point Add(Point a, Point b);
  static Point Add(Point a, float32 b);
};