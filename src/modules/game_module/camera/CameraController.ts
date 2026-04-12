import { DEFAULT_CAMERA_CONFIG, type CameraConfig, type CameraState, type CameraTarget, type CameraViewport } from './CameraTypes';
import { getEdgePanIntent, getViewportCenter, worldToScreen } from './cameraMath';

export class CameraController {
  readonly state: CameraState;
  private viewport: CameraViewport = { width: 300, height: 150 };
  private lastUpdateMs = 0;

  constructor(config: Partial<CameraConfig> = {}) {
    const resolvedConfig = { ...DEFAULT_CAMERA_CONFIG, ...config };
    this.state = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      zoom: resolvedConfig.zoom,
      mode: 'free',
      followTargetId: null,
      input: {
        pointerX: 0,
        pointerY: 0,
        pointerInside: false,
        dragActive: false,
        lastMouseX: 0,
        lastMouseY: 0,
      },
      config: resolvedConfig,
    };
  }

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  setPointerPosition(x: number, y: number, pointerInside = true): void {
    this.state.input.pointerX = x;
    this.state.input.pointerY = y;
    this.state.input.pointerInside = pointerInside;
  }

  setPointerInside(pointerInside: boolean): void {
    this.state.input.pointerInside = pointerInside;
  }

  beginDrag(x: number, y: number): void {
    this.cancelFollow();
    this.state.mode = 'drag';
    this.state.input.dragActive = true;
    this.state.input.lastMouseX = x;
    this.state.input.lastMouseY = y;
    this.setPointerPosition(x, y, true);
  }

  dragTo(x: number, y: number): void {
    if (!this.state.input.dragActive) return;

    const dx = x - this.state.input.lastMouseX;
    const dy = y - this.state.input.lastMouseY;
    this.state.x -= dx / this.state.zoom;
    this.state.y -= dy / this.state.zoom;
    this.state.vx = 0;
    this.state.vy = 0;
    this.state.input.lastMouseX = x;
    this.state.input.lastMouseY = y;
    this.setPointerPosition(x, y, true);
  }

  endDrag(): void {
    this.state.input.dragActive = false;
    this.state.mode = 'free';
    this.state.followTargetId = null;
  }

  focusTarget(targetId: number, target?: CameraTarget, recenter = false): void {
    this.state.followTargetId = targetId;
    this.state.mode = 'soft_follow';
    this.state.vx = 0;
    this.state.vy = 0;

    if (target && recenter) {
      const center = getViewportCenter(this.viewport);
      this.state.x = target.x - center.x / this.state.zoom;
      this.state.y = target.y - center.y / this.state.zoom;
    }
  }

  cancelFollow(): void {
    if (this.state.mode === 'soft_follow') {
      this.state.mode = 'free';
      this.state.followTargetId = null;
    }
  }

  update(targets: Map<number, CameraTarget>, nowMs: number): void {
    const dtSeconds = this.getDeltaSeconds(nowMs);

    if (this.state.input.dragActive) {
      this.state.mode = 'drag';
      return;
    }

    const edgeMoved = this.updateEdgePan(dtSeconds);
    if (!edgeMoved && this.state.mode === 'soft_follow') {
      this.updateSoftFollow(targets);
    }
  }

  private updateEdgePan(dtSeconds: number): boolean {
    const input = this.state.input;
    if (!input.pointerInside || input.dragActive) return false;

    const intent = getEdgePanIntent(
      { x: input.pointerX, y: input.pointerY },
      this.viewport,
      this.state.config.edgePanMarginPx,
    );
    const magnitude = Math.hypot(intent.x, intent.y);
    if (magnitude <= 0.001) {
      this.state.vx *= 1 - this.state.config.edgePanSmoothing;
      this.state.vy *= 1 - this.state.config.edgePanSmoothing;
      return false;
    }

    this.cancelFollow();
    const normalX = intent.x / Math.max(1, magnitude);
    const normalY = intent.y / Math.max(1, magnitude);
    const targetVx = normalX * this.state.config.edgePanMaxSpeed * magnitude;
    const targetVy = normalY * this.state.config.edgePanMaxSpeed * magnitude;
    this.state.vx += (targetVx - this.state.vx) * this.state.config.edgePanSmoothing;
    this.state.vy += (targetVy - this.state.vy) * this.state.config.edgePanSmoothing;
    this.state.x += (this.state.vx * dtSeconds) / this.state.zoom;
    this.state.y += (this.state.vy * dtSeconds) / this.state.zoom;
    return true;
  }

  private updateSoftFollow(targets: Map<number, CameraTarget>): void {
    if (this.state.followTargetId == null) return;
    const target = targets.get(this.state.followTargetId);
    if (!target) {
      this.cancelFollow();
      return;
    }

    const screen = worldToScreen(target, this.state);
    const center = getViewportCenter(this.viewport);
    const dx = screen.x - center.x;
    const dy = screen.y - center.y;
    const distance = Math.hypot(dx, dy);
    const deadZone = this.state.config.deadZoneRadiusPx;
    if (distance <= deadZone || distance <= 0.001) {
      this.state.vx = 0;
      this.state.vy = 0;
      return;
    }

    const excess = distance - deadZone;
    const correctionX = (dx / distance) * excess / this.state.zoom;
    const correctionY = (dy / distance) * excess / this.state.zoom;
    this.state.x += correctionX * this.state.config.followSmoothing;
    this.state.y += correctionY * this.state.config.followSmoothing;
  }

  private getDeltaSeconds(nowMs: number): number {
    if (this.lastUpdateMs === 0) {
      this.lastUpdateMs = nowMs;
      return 0;
    }

    const dtMs = Math.max(0, Math.min(50, nowMs - this.lastUpdateMs));
    this.lastUpdateMs = nowMs;
    return dtMs / 1000;
  }
}
