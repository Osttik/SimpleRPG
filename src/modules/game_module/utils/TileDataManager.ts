import { RegistryManager } from './RegistryManager';

export class TileDataManager {
    // Flat Float32Array to store the pre-calculated textureArrayLayer
    // Index: (tileId * 256) + mask
    static lookupTable: Float32Array;
    static maxTileId = 0;
    static cols = 0;
    
    // Default sheet used for tiles in WebGL Texture Array
    static tileSheetKey = "forest_env";
    static tileSize = 16;
    
    static init(cols: number, tileSize: number) {
        this.cols = cols;
        this.tileSize = tileSize;
        
        // Find max tile ID from RegistryManager
        for (const [id] of RegistryManager.tilesById.entries()) {
            if (id > this.maxTileId) {
                this.maxTileId = id;
            }
        }
        
        // Initialize flat lookup table
        const tableSize = (this.maxTileId + 1) * 256;
        this.lookupTable = new Float32Array(tableSize);
        
        // Fill table with fallback layer (row: 0, col: 0 -> layer 0)
        this.lookupTable.fill(0);
        
        for (const [id, data] of RegistryManager.tilesById.entries()) {
            const visualData = data.visual;
            if (!visualData || !visualData.masks) continue;
            
            // Only bake tiles that belong to the main tile sheet into this lookup table
            if (visualData.sheet !== this.tileSheetKey) continue;
            
            for (let mask = 0; mask < 256; mask++) {
                let variant = visualData.masks[mask.toString()];
                if (!variant) {
                    variant = visualData.masks['0'] || Object.values(visualData.masks)[0];
                }
                
                if (variant) {
                    const layerId = variant.row * cols + variant.col;
                    const index = (id * 256) + mask;
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
