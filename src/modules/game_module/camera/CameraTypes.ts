export type CameraMode = 'free' | 'drag' | 'soft_follow';

export interface CameraTarget {
  id: number;
  x: number;
  y: number;
  radius?: number;
}

export interface CameraViewport {
  width: number;
  height: number;
}

export interface CameraConfig {
  deadZoneRadiusPx: number;
  edgePanMarginPx: number;
  edgePanMaxSpeed: number;
  followSmoothing: number;
  edgePanSmoothing: number;
  zoom: number;
}

export interface CameraInputState {
  pointerX: number;
  pointerY: number;
  pointerInside: boolean;
  dragActive: boolean;
  lastMouseX: number;
  lastMouseY: number;
}

export interface CameraState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zoom: number;
  mode: CameraMode;
  followTargetId: number | null;
  input: CameraInputState;
  config: CameraConfig;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  deadZoneRadiusPx: 160,
  edgePanMarginPx: 72,
  edgePanMaxSpeed: 620,
  followSmoothing: 0.16,
  edgePanSmoothing: 0.22,
  zoom: 1,
};
