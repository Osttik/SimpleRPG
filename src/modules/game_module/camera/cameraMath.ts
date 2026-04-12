import type { CameraState, CameraViewport } from './CameraTypes';

export interface Point2 {
  x: number;
  y: number;
}

export function worldToScreen(world: Point2, camera: CameraState): Point2 {
  return {
    x: (world.x - camera.x) * camera.zoom,
    y: (world.y - camera.y) * camera.zoom,
  };
}

export function screenToWorld(screen: Point2, camera: CameraState): Point2 {
  return {
    x: camera.x + (screen.x / camera.zoom),
    y: camera.y + (screen.y / camera.zoom),
  };
}

export function getViewportCenter(viewport: CameraViewport): Point2 {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2,
  };
}

export function getEdgePanIntent(pointer: Point2, viewport: CameraViewport, edgeMarginPx: number): Point2 {
  if (edgeMarginPx <= 0) return { x: 0, y: 0 };

  let x = 0;
  let y = 0;
  if (pointer.x < edgeMarginPx) {
    x = -((edgeMarginPx - pointer.x) / edgeMarginPx);
  } else if (pointer.x > viewport.width - edgeMarginPx) {
    x = (pointer.x - (viewport.width - edgeMarginPx)) / edgeMarginPx;
  }

  if (pointer.y < edgeMarginPx) {
    y = -((edgeMarginPx - pointer.y) / edgeMarginPx);
  } else if (pointer.y > viewport.height - edgeMarginPx) {
    y = (pointer.y - (viewport.height - edgeMarginPx)) / edgeMarginPx;
  }

  return {
    x: clamp(x, -1, 1),
    y: clamp(y, -1, 1),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
