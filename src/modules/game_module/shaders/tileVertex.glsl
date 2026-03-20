#version 300 es
in vec2 a_position;
in vec2 a_instancePosition;
in float a_spriteId;
in float a_cz;

uniform vec2 u_resolution;
uniform float u_tileSize;

out vec2 v_uv;
out float v_spriteId;
out float v_cz;

void main() {
  vec2 worldPos = a_position * u_tileSize + a_instancePosition;
  
  vec2 zeroToOne = worldPos / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_uv = a_position;
  v_spriteId = a_spriteId;
  v_cz = a_cz;
}
