import tilesRegistry from '../../../assets/tiles_registry.json';
import spritesData from '../../../assets/sprites_data.json';

export interface TileData {
    id: number;
    name: string;
    collide: boolean;
}

export class TileDataManager {
    static registry: TileData[] = tilesRegistry;
    static spritesConfig: any = spritesData;
    
    // Flat Float32Array to store the pre-calculated textureArrayLayer
    // Index: (tileId * 256) + mask
    static lookupTable: Float32Array;
    static maxTileId = 0;
    static cols = 0;
    
    static init(cols: number) {
        this.cols = cols;
        
        // Find max tile ID
        for (const tile of this.registry) {
            if (tile.id > this.maxTileId) {
                this.maxTileId = tile.id;
            }
        }
        
        // Initialize flat lookup table
        const tableSize = (this.maxTileId + 1) * 256;
        this.lookupTable = new Float32Array(tableSize);
        
        // Fill table with fallback layer (row: 0, col: 0 -> layer 0)
        this.lookupTable.fill(0);
        
        for (const tile of this.registry) {
            const tileData = this.spritesConfig.tiles[tile.name];
            if (!tileData) continue;
            
            for (let mask = 0; mask < 256; mask++) {
                let variant = tileData[`mask_${mask}`];
                if (!variant) {
                    variant = tileData['mask_0'] || Object.values(tileData)[0];
                }
                
                if (variant) {
                    const layerId = variant.row * cols + variant.col;
                    const index = (tile.id * 256) + mask;
                    this.lookupTable[index] = layerId;
                }
            }
        }
    }
    
    static getVisualData(tileId: number, mask: number): { row: number, col: number, layer: number } {
        const layer = this.getSpriteLayer(tileId, mask);
        
        let row = 0;
        let col = 0;
        
        if (this.cols > 0) {
            row = Math.floor(layer / this.cols);
            col = layer % this.cols;
        }
        
        return { row, col, layer };
    }
    
    static getSpriteLayer(tileId: number, mask: number): number {
        if (tileId < 0 || tileId > this.maxTileId) {
            return 0; // Fallback "Missing Texture"
        }
        return this.lookupTable[(tileId * 256) + mask] || 0;
    }
}
