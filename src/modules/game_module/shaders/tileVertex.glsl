#version 300 es
in vec2 a_position;
in vec2 a_instancePosition;
in float a_tileType;
in float a_cz;

uniform vec2 u_resolution;
uniform float u_tileSize;

out float v_tileType;
out float v_cz;

void main() {
  vec2 worldPos = a_position * u_tileSize + a_instancePosition;
  
  vec2 zeroToOne = worldPos / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_tileType = a_tileType;
  v_cz = a_cz;
}
