import { createProgram, createShader } from '../utils/webGLUtils';
import type { CharacterPose, ResolvedPartPose } from '../animation/types/AnimationTypes';
import type { ResolvedCharacterRigSkin } from './CharacterRigRegistry';

const vertexSource = `#version 300 es
precision mediump float;

in vec2 a_position;
in vec2 a_texCoord;
uniform vec2 u_resolution;
out vec2 v_texCoord;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  v_texCoord = a_texCoord;
}`;

const fragmentSource = `#version 300 es
precision mediump float;

uniform sampler2D u_texture;
uniform vec4 u_tint;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  if (texColor.a < 0.1) discard;
  outColor = texColor * u_tint;
}`;

const VERTEX_FLOATS = 4;
const QUAD_VERTEX_COUNT = 6;

export class CompositeCharacterRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly positionLoc: number;
  private readonly texCoordLoc: number;
  private readonly resolutionLoc: WebGLUniformLocation | null;
  private readonly textureLoc: WebGLUniformLocation | null;
  private readonly tintLoc: WebGLUniformLocation | null;
  private readonly vertexData = new Float32Array(QUAD_VERTEX_COUNT * VERTEX_FLOATS);

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.textureLoc = gl.getUniformLocation(this.program, 'u_texture');
    this.tintLoc = gl.getUniformLocation(this.program, 'u_tint');
    this.buffer = gl.createBuffer()!;
  }

  draw(pose: CharacterPose, rigSkin: ResolvedCharacterRigSkin, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, VERTEX_FLOATS * 4, 0);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, VERTEX_FLOATS * 4, 2 * 4);
    gl.uniform2f(this.resolutionLoc, viewportWidth, viewportHeight);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, rigSkin.texture);
    gl.uniform1i(this.textureLoc, 2);

    for (const part of pose.parts) {
      this.writePartVertices(part, rigSkin.textureSize.width, rigSkin.textureSize.height, cameraX, cameraY);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);
      gl.uniform4f(this.tintLoc, part.tint[0], part.tint[1], part.tint[2], part.tint[3]);
      gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT);
    }
  }

  private writePartVertices(part: ResolvedPartPose, textureWidth: number, textureHeight: number, cameraX: number, cameraY: number): void {
    const [rectX, rectY, rectW, rectH] = part.rect;
    const u0 = rectX / textureWidth;
    const v0 = rectY / textureHeight;
    const u1 = (rectX + rectW) / textureWidth;
    const v1 = (rectY + rectH) / textureHeight;
    const corners = [
      [0, 0, u0, v0],
      [rectW, 0, u1, v0],
      [0, rectH, u0, v1],
      [0, rectH, u0, v1],
      [rectW, 0, u1, v0],
      [rectW, rectH, u1, v1],
    ] as const;
    const cos = Math.cos(part.rotation);
    const sin = Math.sin(part.rotation);

    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i];
      const localX = (corner[0] - part.pivot[0]) * part.scale * (part.xFlip ? -1 : 1);
      const localY = (corner[1] - part.pivot[1]) * part.scale * part.yScale;
      const worldX = part.x + (localX * cos) - (localY * sin);
      const worldY = part.y + (localX * sin) + (localY * cos);
      const offset = i * VERTEX_FLOATS;
      this.vertexData[offset + 0] = worldX - cameraX;
      this.vertexData[offset + 1] = worldY - cameraY;
      this.vertexData[offset + 2] = corner[2];
      this.vertexData[offset + 3] = corner[3];
    }
  }
}
