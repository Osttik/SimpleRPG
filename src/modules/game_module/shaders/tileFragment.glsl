#version 300 es
precision mediump float;
precision mediump sampler2DArray;

in vec2 v_uv;
in float v_spriteId;
in float v_layerOffset;
in float v_roofFade;
in float v_occlusion;
out vec4 outColor;

uniform sampler2DArray u_textures;

void main() {
  vec4 texColor = texture(u_textures, vec3(v_uv, v_spriteId));

  float tint = 1.0;
  float alpha = texColor.a;
  vec3 rgb = texColor.rgb;

  if (v_layerOffset < 0.0) {
    tint = max(0.28, 1.0 + v_layerOffset * 0.22);
    rgb *= tint;
  } else if (v_layerOffset > 0.0) {
    float metadataFade = mix(v_roofFade * 0.28, v_roofFade, clamp(v_occlusion, 0.0, 1.0));
    float haze = min(0.9, 0.16 + v_layerOffset * 0.14 + metadataFade * (0.3 + v_occlusion * 0.42));
    rgb = mix(rgb, vec3(0.86, 0.92, 1.0), haze);
    alpha *= max(0.06, 0.8 - v_layerOffset * 0.1 - metadataFade * (0.22 + v_occlusion * 0.5));
  }
  
  outColor = vec4(rgb, alpha);
}
