import { TileDataManager } from './TileDataManager';
import defaultTilesetPath from '../../../assets/Tileset.png';

export class SpriteSystem {
  static textureArray: WebGLTexture | null = null;
  
  static async init(gl: WebGL2RenderingContext) {
    const response = await fetch(defaultTilesetPath);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);

    const tileSize = 16;
    const cols = img.width / tileSize;
    const rows = img.height / tileSize;
    const depth = cols * rows;

    this.textureArray = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);

    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, tileSize, tileSize, depth);

    const canvas = new OffscreenCanvas(tileSize, tileSize);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.clearRect(0, 0, tileSize, tileSize);
        ctx.drawImage(img, c * tileSize, r * tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize);
        
        const layer = r * cols + c;
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, tileSize, tileSize, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      }
    }

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Initialize the TileDataManager with the calculated columns
    TileDataManager.init(cols);
  }

  static getSpriteId(tileType: number, mask: number): number {
    return TileDataManager.getSpriteLayer(tileType, mask);
  }
}
