#version 300 es
precision mediump float;

uniform vec4 u_color;
uniform sampler2D u_texture;
uniform vec2 u_uvOffset;
uniform vec2 u_uvScale;
uniform bool u_useTexture;

out vec4 outColor;

void main() {
  vec2 coord = gl_PointCoord;
  
  if (u_useTexture) {
      vec2 uv = coord * u_uvScale + u_uvOffset;
      vec4 texColor = texture(u_texture, uv);
      if (texColor.a < 0.1) discard;
      outColor = vec4(texColor.rgb, texColor.a);
  } else {
      // Fallback to circle
      float dist = length(coord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
      outColor = vec4(u_color.rgb, u_color.a * alpha);
  }
}