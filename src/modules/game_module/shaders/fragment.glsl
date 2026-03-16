#version 300 es
precision mediump float;

uniform vec4 u_color;
out vec4 outColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);

  if (dist > 0.5) {
    discard;
  }
  
  float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
  
  outColor = vec4(u_color.rgb, u_color.a * alpha);
}