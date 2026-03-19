#version 300 es
precision mediump float;

in float v_tileType;
in float v_cz;
out vec4 outColor;

void main() {
  if (v_tileType < 0.5) {
     discard;
  }
  
  // NOTE: there should be type of tile and etc... for now just solid colors
  vec3 baseColor = vec3(1.0);
  if (v_tileType > 0.5 && v_tileType < 1.5) {
    baseColor = vec3(0.2, 0.8, 0.2); // Grass
  } else if (v_tileType > 1.5 && v_tileType < 2.5) {
    baseColor = vec3(0.5, 0.5, 0.5); // Stone
  }
  
  float tint = 1.0;
  if (v_cz < 0.0) {
    tint = max(0.2, 1.0 + v_cz * 0.4); 
  }
  
  outColor = vec4(baseColor * tint, 1.0);
}
