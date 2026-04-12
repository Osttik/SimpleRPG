import { HUMANOID_COMBAT_RIG_CONTRACT } from '../animation/generated/combatRigContract';
import { createProgram, createShader } from '../utils/webGLUtils';
import type { CharacterPose } from '../animation/types/AnimationTypes';
import type { Vec2 } from '../animation/types/RigTypes';

const vertexSource = `#version 300 es
precision mediump float;

in vec2 a_position;
uniform vec2 u_resolution;
uniform float u_pointSize;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  gl_PointSize = u_pointSize;
}`;

const fragmentSource = `#version 300 es
precision mediump float;

uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}`;

const MAX_LINE_FLOATS = 4096;
const MAX_POINT_FLOATS = 1024;

export class CombatDebugOverlayRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly positionLoc: number;
  private readonly resolutionLoc: WebGLUniformLocation | null;
  private readonly colorLoc: WebGLUniformLocation | null;
  private readonly pointSizeLoc: WebGLUniformLocation | null;
  private readonly lineData = new Float32Array(MAX_LINE_FLOATS);
  private readonly pointData = new Float32Array(MAX_POINT_FLOATS);

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
    this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.colorLoc = gl.getUniformLocation(this.program, 'u_color');
    this.pointSizeLoc = gl.getUniformLocation(this.program, 'u_pointSize');
    this.buffer = gl.createBuffer()!;
  }

  draw(pose: CharacterPose, cameraX: number, cameraY: number, viewportWidth: number, viewportHeight: number): void {
    if (!pose.debug) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.resolutionLoc, viewportWidth, viewportHeight);

    const debug = pose.debug;
    const contractScale = HUMANOID_COMBAT_RIG_CONTRACT.units.frontendScale;
    let lineFloats = 0;
    let pointFloats = 0;
    const toScreen = (point: Vec2): Vec2 => [point[0] - cameraX, point[1] - cameraY];
    const localToWorld = (local: Vec2): Vec2 => transformCombatLocal(pose.x, pose.y, local, debug.upperFacingAngle);
    const pushLine = (a: Vec2, b: Vec2) => {
      if (lineFloats + 4 > this.lineData.length) return;
      const sa = toScreen(a);
      const sb = toScreen(b);
      this.lineData[lineFloats++] = sa[0];
      this.lineData[lineFloats++] = sa[1];
      this.lineData[lineFloats++] = sb[0];
      this.lineData[lineFloats++] = sb[1];
    };
    const pushPoint = (point: Vec2) => {
      if (pointFloats + 2 > this.pointData.length) return;
      const screen = toScreen(point);
      this.pointData[pointFloats++] = screen[0];
      this.pointData[pointFloats++] = screen[1];
    };

    for (const hurtbox of HUMANOID_COMBAT_RIG_CONTRACT.hurtboxes) {
      if (hurtbox.primitive === 'circle') {
        pushCircle(localToWorld([hurtbox.center[0] * contractScale, hurtbox.center[1] * contractScale]), hurtbox.radius * contractScale, 12, pushLine);
      } else {
        const min = hurtbox.min;
        const max = hurtbox.max;
        const a = localToWorld([min[0] * contractScale, min[1] * contractScale]);
        const b = localToWorld([max[0] * contractScale, min[1] * contractScale]);
        const c = localToWorld([max[0] * contractScale, max[1] * contractScale]);
        const d = localToWorld([min[0] * contractScale, max[1] * contractScale]);
        pushLine(a, b);
        pushLine(b, c);
        pushLine(c, d);
        pushLine(d, a);
      }
    }

    pushLine(debug.shoulder, debug.elbow);
    pushLine(debug.elbow, debug.wrist);
    pushLine(debug.wrist, debug.weaponTip);
    pushPoint(debug.shoulder);
    pushPoint(debug.elbow);
    pushPoint(debug.wrist);
    pushPoint(debug.weaponTip);
    if (debug.shieldAnchor) pushPoint(debug.shieldAnchor);

    const chestY = HUMANOID_COMBAT_RIG_CONTRACT.routing.torsoVirtualZones[0].minYExclusive ?? 4;
    const pelvisY = HUMANOID_COMBAT_RIG_CONTRACT.routing.torsoVirtualZones[1].maxYExclusive ?? -4;
    pushLine(localToWorld([-10 * contractScale, chestY * contractScale]), localToWorld([10 * contractScale, chestY * contractScale]));
    pushLine(localToWorld([-10 * contractScale, pelvisY * contractScale]), localToWorld([10 * contractScale, pelvisY * contractScale]));

    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.subarray(0, lineFloats), gl.DYNAMIC_DRAW);
    gl.uniform1f(this.pointSizeLoc, 3);
    gl.uniform4f(this.colorLoc, 0.1, 1.0, 0.65, 0.82);
    gl.drawArrays(gl.LINES, 0, lineFloats / 2);

    gl.bufferData(gl.ARRAY_BUFFER, this.pointData.subarray(0, pointFloats), gl.DYNAMIC_DRAW);
    gl.uniform1f(this.pointSizeLoc, 5);
    gl.uniform4f(this.colorLoc, 1.0, 0.95, 0.2, 0.95);
    gl.drawArrays(gl.POINTS, 0, pointFloats / 2);

    if (debug.shieldAnchor && debug.shieldIntegrity != null) {
      const maxIntegrity = Math.max(1, HUMANOID_COMBAT_RIG_CONTRACT.shield.maxIntegrity);
      const normalizedIntegrity = Math.max(0, Math.min(1, debug.shieldIntegrity / maxIntegrity));
      const shieldPoint = toScreen(debug.shieldAnchor);
      this.pointData[0] = shieldPoint[0];
      this.pointData[1] = shieldPoint[1];
      gl.bufferData(gl.ARRAY_BUFFER, this.pointData.subarray(0, 2), gl.DYNAMIC_DRAW);
      gl.uniform1f(this.pointSizeLoc, debug.shieldBroken ? 9 : 5 + ((1 - normalizedIntegrity) * 4));
      gl.uniform4f(this.colorLoc, 1.0, normalizedIntegrity, 0.12, 0.95);
      gl.drawArrays(gl.POINTS, 0, 1);
    }
  }
}

function transformCombatLocal(rootX: number, rootY: number, local: Vec2, angle: number): Vec2 {
  const rightX = Math.cos(angle);
  const rightY = -Math.sin(angle);
  const forwardX = Math.sin(angle);
  const forwardY = Math.cos(angle);
  return [
    rootX + (rightX * local[0]) + (forwardX * local[1]),
    rootY + (rightY * local[0]) + (forwardY * local[1]),
  ];
}

function pushCircle(center: Vec2, radius: number, segments: number, pushLine: (a: Vec2, b: Vec2) => void): void {
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    pushLine(
      [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius],
      [center[0] + Math.cos(b) * radius, center[1] + Math.sin(b) * radius],
    );
  }
}
