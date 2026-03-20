import { TileDataManager } from './TileDataManager';
import { AssetManager } from './AssetManager';
import spritesData from '../../../assets/sprites_data.json';

export class SpriteSystem {
  static textureArray: WebGLTexture | null = null;
  static entityTextures = new Map<string, WebGLTexture>(); // Maps sheetKey to GL Texture
  static entityDimensions = new Map<string, { width: number, height: number }>();
  static gl: WebGL2RenderingContext | null = null;
  
  static async init(gl: WebGL2RenderingContext) {
    this.gl = gl;
    
    // 1. Initialize the main Tileset Texture Array
    // According to our definitions, tiles are on the "forest_env" sheet
    await this.initTileSheet(gl, "forest_env");
  }

  static async initTileSheet(gl: WebGL2RenderingContext, sheetKey: string) {
    const sheets: any = (spritesData as any).sheets;
    const sheetInfo = sheets[sheetKey];
    if (!sheetInfo) throw new Error(`Sheet ${sheetKey} not found`);

    const img = await AssetManager.getTexture(sheetKey);

    const tileSize = sheetInfo.tileSize || 16;
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
    TileDataManager.init(cols, tileSize);
  }

  // Gets or creates a standard 2D texture for an entity sheet
  static async getEntityTexture(sheetKey: string): Promise<WebGLTexture> {
    if (!this.gl) throw new Error("SpriteSystem not initialized with GL context");
    
    if (this.entityTextures.has(sheetKey)) {
        return this.entityTextures.get(sheetKey)!;
    }

    const img = await AssetManager.getTexture(sheetKey);
    const gl = this.gl;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.entityTextures.set(sheetKey, texture);
    this.entityDimensions.set(sheetKey, { width: img.width, height: img.height });
    return texture;
  }

  static getSpriteId(tileType: number, mask: number): number {
    return TileDataManager.getSpriteLayer(tileType, mask);
  }
}
