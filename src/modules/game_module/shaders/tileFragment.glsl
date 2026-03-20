#version 300 es
precision mediump float;
precision mediump sampler2DArray;

in vec2 v_uv;
in float v_spriteId;
in float v_cz;
out vec4 outColor;

uniform sampler2DArray u_textures;

void main() {
  vec4 texColor = texture(u_textures, vec3(v_uv, v_spriteId));

  float tint = 1.0;
  if (v_cz < 0.0) {
    tint = max(0.2, 1.0 + v_cz * 0.4); 
  }
  
  outColor = vec4(texColor.rgb * tint, texColor.a);
}
