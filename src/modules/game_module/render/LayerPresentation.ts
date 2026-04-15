export const RENDER_LAYER_RADIUS = 3;
export const TILE_RENDER_FLOATS = 6;

export interface TileFadeMetadata {
  roof?: boolean;
  occludes?: boolean;
}

export interface VisibleLayerWindow {
  minLayer: number;
  maxLayer: number;
}

export function getVisibleLayerWindow(currentLayer: number): VisibleLayerWindow {
  return {
    minLayer: currentLayer - RENDER_LAYER_RADIUS,
    maxLayer: currentLayer + RENDER_LAYER_RADIUS,
  };
}

export function isLayerVisible(layer: number, window: VisibleLayerWindow): boolean {
  return layer >= window.minLayer && layer <= window.maxLayer;
}

export function getRoofFadeStrength(
  tileCenterX: number,
  tileCenterY: number,
  playerX: number,
  playerY: number,
  layerOffset: number,
  tileSize: number,
  metadata?: TileFadeMetadata,
): number {
  if (layerOffset <= 0) return 0;

  const strongCover = Boolean(metadata?.roof || metadata?.occludes);
  const fadeRadius = tileSize * (strongCover ? 5 : 3.25);
  const dx = tileCenterX - playerX;
  const dy = tileCenterY - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const normalized = Math.max(0, Math.min(1, 1 - distance / fadeRadius));
  return strongCover ? normalized : normalized * 0.45;
}

export function getUpperTileOcclusionWeight(metadata?: TileFadeMetadata): number {
  if (metadata?.roof) return 1;
  if (metadata?.occludes) return 0.72;
  return 0.18;
}
