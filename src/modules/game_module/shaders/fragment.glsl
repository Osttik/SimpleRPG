precision mediump float;
uniform vec4 u_color;

void main() {
  // gl_PointCoord goes from 0.0 to 1.0 across the point sprite.
  // Center is at 0.5, 0.5
  vec2 coord = gl_PointCoord - vec2(0.5);
  // Calculate distance from center (range 0.0 to 0.5 for points inside circle)
  float dist = length(coord);
  
  // If outside the circle, discard the fragment
  if (dist > 0.5) {
      discard;
  }
  
  // Use smoothstep for anti-aliasing the edge
  float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
  
  gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}