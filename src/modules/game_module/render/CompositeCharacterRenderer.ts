import { createProgram, createShader } from '../utils/webGLUtils';
import type { CharacterPose, ResolvedPartPose } from '../animation/types/AnimationTypes';
import { animationMetrics } from '../animation/debug/AnimationMetrics';
import type { ResolvedCharacterRigSkin } from './CharacterRigRegistry';

const vertexSource = `#version 300 es
precision mediump float;

in vec2 a_corner;
in vec2 a_instancePosition;
in vec2 a_rotation;
in vec2 a_size;
in vec2 a_pivot;
in vec2 a_scale;
in vec4 a_uv;
in vec4 a_tint;
in float a_layer;

uniform vec2 u_resolution;

out vec2 v_texCoord;
out vec4 v_tint;

void main() {
  vec2 local = ((a_corner * a_size) - a_pivot) * a_scale;
  vec2 rotated = vec2(
    local.x * a_rotation.x - local.y * a_rotation.y,
    local.x * a_rotation.y + local.y * a_rotation.x
  );
  vec2 screen = a_instancePosition + rotated;
  vec2 zeroToOne = screen / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  float z = 1.0 - min(a_layer * 0.0002, 2.0);

  gl_Position = vec4(clipSpace * vec2(1, -1), z, 1);
  v_texCoord = mix(a_uv.xy, a_uv.zw, a_corner);
  v_tint = a_tint;
}`;

const fragmentSource = `#version 300 es
precision mediump float;

uniform sampler2D u_texture;

in vec2 v_texCoord;
in vec4 v_tint;

out vec4 outColor;

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  if (texColor.a < 0.1) discard;
  outColor = texColor * v_tint;
}`;

const INSTANCE_FLOATS = 21;
const QUAD_VERTEX_COUNT = 6;
const INITIAL_INSTANCE_CAPACITY = 2048;

export interface CharacterRenderBatchItem {
  pose: CharacterPose;
  rigSkin: ResolvedCharacterRigSkin;
}

interface TextureBatch {
  rigSkin: ResolvedCharacterRigSkin;
  parts: Array<{ part: ResolvedPartPose; layer: number }>;
}

export class CompositeCharacterRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly cornerBuffer: WebGLBuffer;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly cornerLoc: number;
  private readonly instancePositionLoc: number;
  private readonly rotationLoc: number;
  private readonly sizeLoc: number;
  private readonly pivotLoc: number;
  private readonly scaleLoc: number;
  private readonly uvLoc: number;
  private readonly tintLoc: number;
  private readonly layerLoc: number;
  private readonly resolutionLoc: WebGLUniformLocation | null;
  private readonly textureLoc: WebGLUniformLocation | null;
  private instanceData = new Float32Array(INITIAL_INSTANCE_CAPACITY * INSTANCE_FLOATS);

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.cornerLoc = gl.getAttribLocation(this.program, 'a_corner');
    this.instancePositionLoc = gl.getAttribLocation(this.program, 'a_instancePosition');
    this.rotationLoc = gl.getAttribLocation(this.program, 'a_rotation');
    this.sizeLoc = gl.getAttribLocation(this.program, 'a_size');
    this.pivotLoc = gl.getAttribLocation(this.program, 'a_pivot');
    this.scaleLoc = gl.getAttribLocation(this.program, 'a_scale');
    this.uvLoc = gl.getAttribLocation(this.program, 'a_uv');
    this.tintLoc = gl.getAttribLocation(this.program, 'a_tint');
    this.layerLoc = gl.getAttribLocation(this.program, 'a_layer');
    this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.textureLoc = gl.getUniformLocation(this.program, 'u_texture');

    this.cornerBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);

    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
  }

  drawBatch(items: readonly CharacterRenderBatchItem[], cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    const batches = this.buildBatches(items);
    if (batches.length === 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(this.resolutionLoc, viewportWidth, viewportHeight);
    gl.uniform1i(this.textureLoc, 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(this.cornerLoc);
    gl.vertexAttribPointer(this.cornerLoc, 2, gl.FLOAT, false, 0, 0);

    this.bindInstanceAttributes();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let drawCalls = 0;
    for (const batch of batches) {
      const instanceCount = batch.parts.length;
      this.ensureCapacity(instanceCount);
      this.writeInstances(batch, cameraX, cameraY);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, instanceCount * INSTANCE_FLOATS));
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, batch.rigSkin.texture);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, instanceCount);
      drawCalls++;
    }

    this.resetInstanceDivisors();
    gl.disable(gl.DEPTH_TEST);
    animationMetrics.drawCallsAfterBatching += drawCalls;
  }

  private buildBatches(items: readonly CharacterRenderBatchItem[]): TextureBatch[] {
    const batches = new Map<WebGLTexture, TextureBatch>();
    let layer = 0;

    for (const item of items) {
      let batch = batches.get(item.rigSkin.texture);
      if (!batch) {
        batch = { rigSkin: item.rigSkin, parts: [] };
        batches.set(item.rigSkin.texture, batch);
      }

      for (const part of item.pose.parts) {
        batch.parts.push({ part, layer: layer++ });
      }
    }

    return Array.from(batches.values());
  }

  private bindInstanceAttributes(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const stride = INSTANCE_FLOATS * 4;
    this.bindInstancedAttrib(this.instancePositionLoc, 2, stride, 0);
    this.bindInstancedAttrib(this.rotationLoc, 2, stride, 2);
    this.bindInstancedAttrib(this.sizeLoc, 2, stride, 4);
    this.bindInstancedAttrib(this.pivotLoc, 2, stride, 6);
    this.bindInstancedAttrib(this.scaleLoc, 2, stride, 8);
    this.bindInstancedAttrib(this.uvLoc, 4, stride, 10);
    this.bindInstancedAttrib(this.tintLoc, 4, stride, 14);
    this.bindInstancedAttrib(this.layerLoc, 1, stride, 18);
  }

  private bindInstancedAttrib(location: number, size: number, stride: number, floatOffset: number): void {
    const gl = this.gl;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, floatOffset * 4);
    gl.vertexAttribDivisor(location, 1);
  }

  private resetInstanceDivisors(): void {
    const gl = this.gl;
    for (const location of [
      this.instancePositionLoc,
      this.rotationLoc,
      this.sizeLoc,
      this.pivotLoc,
      this.scaleLoc,
      this.uvLoc,
      this.tintLoc,
      this.layerLoc,
    ]) {
      gl.vertexAttribDivisor(location, 0);
    }
  }

  private ensureCapacity(instanceCount: number): void {
    if (instanceCount * INSTANCE_FLOATS <= this.instanceData.length) return;

    let nextCapacity = this.instanceData.length / INSTANCE_FLOATS;
    while (nextCapacity < instanceCount) nextCapacity *= 2;
    this.instanceData = new Float32Array(nextCapacity * INSTANCE_FLOATS);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanceData.byteLength, this.gl.DYNAMIC_DRAW);
  }

  private writeInstances(batch: TextureBatch, cameraX: number, cameraY: number): void {
    const textureWidth = batch.rigSkin.textureSize.width;
    const textureHeight = batch.rigSkin.textureSize.height;

    for (let i = 0; i < batch.parts.length; i++) {
      const { part, layer } = batch.parts[i];
      this.writePartInstance(i, part, layer, textureWidth, textureHeight, cameraX, cameraY);
    }

    animationMetrics.instancedQuadsSubmitted += batch.parts.length;
    animationMetrics.drawCallsBeforeBatching += batch.parts.length;
  }

  private writePartInstance(
    index: number,
    part: ResolvedPartPose,
    layer: number,
    textureWidth: number,
    textureHeight: number,
    cameraX: number,
    cameraY: number,
  ): void {
    const [rectX, rectY, rectW, rectH] = part.rect;
    const cos = Math.cos(part.rotation);
    const sin = Math.sin(part.rotation);
    const offset = index * INSTANCE_FLOATS;

    this.instanceData[offset + 0] = part.x - cameraX;
    this.instanceData[offset + 1] = part.y - cameraY;
    this.instanceData[offset + 2] = cos;
    this.instanceData[offset + 3] = sin;
    this.instanceData[offset + 4] = rectW;
    this.instanceData[offset + 5] = rectH;
    this.instanceData[offset + 6] = part.pivot[0];
    this.instanceData[offset + 7] = part.pivot[1];
    this.instanceData[offset + 8] = part.scale * (part.xFlip ? -1 : 1);
    this.instanceData[offset + 9] = part.scale * part.yScale;
    this.instanceData[offset + 10] = rectX / textureWidth;
    this.instanceData[offset + 11] = rectY / textureHeight;
    this.instanceData[offset + 12] = (rectX + rectW) / textureWidth;
    this.instanceData[offset + 13] = (rectY + rectH) / textureHeight;
    this.instanceData[offset + 14] = part.tint[0];
    this.instanceData[offset + 15] = part.tint[1];
    this.instanceData[offset + 16] = part.tint[2];
    this.instanceData[offset + 17] = part.tint[3];
    this.instanceData[offset + 18] = layer;
    this.instanceData[offset + 19] = 0;
    this.instanceData[offset + 20] = 0;
  }
}
