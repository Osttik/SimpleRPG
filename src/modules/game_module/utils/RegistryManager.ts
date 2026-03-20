import tilesRegistryData from '../../../assets/tiles_registry.json';
import entitiesRegistryData from '../../../assets/entities_registry.json';
import spritesData from '../../../assets/sprites_data.json';

export interface LogicData {
    id?: number;
    name?: string;
    collide?: boolean | string;
    type?: string;
    baseSpeed?: number;
    width?: number;
    height?: number;
}

export interface VisualData {
    sheet: string;
    masks?: { [mask: string]: { row: number, col: number } };
    coords?: { row: number, col: number };
}

export class RegistryManager {
    static tilesById = new Map<number, { logic: LogicData, visual: VisualData }>();
    static tilesByName = new Map<string, { logic: LogicData, visual: VisualData }>();
    static entitiesByType = new Map<string, { logic: LogicData, visual: VisualData }>();
    
    // Store original arrays for the server decoupling
    static rawTilesRegistry = tilesRegistryData;
    static rawEntitiesRegistry = entitiesRegistryData;
    static rawSpritesData: any = spritesData;

    static init() {
        this.tilesById.clear();
        this.tilesByName.clear();
        this.entitiesByType.clear();

        // 1. Process Tiles
        for (const tile of tilesRegistryData) {
            const visualData = this.rawSpritesData.sprites[tile.spriteKey];
            if (!visualData) {
                console.warn(`RegistryManager: No visual data found for tile spriteKey '${tile.spriteKey}'`);
                continue;
            }

            const data = {
                logic: tile,
                visual: visualData
            };

            this.tilesById.set(tile.id, data);
            this.tilesByName.set(tile.name, data);
        }

        // 2. Process Entities
        for (const entity of entitiesRegistryData) {
            const visualData = this.rawSpritesData.sprites[entity.spriteKey];
            if (!visualData) {
                console.warn(`RegistryManager: No visual data found for entity spriteKey '${entity.spriteKey}'`);
                continue;
            }

            const data = {
                logic: entity,
                visual: visualData
            };

            this.entitiesByType.set(entity.type, data);
        }
    }

    static getTileLogic(id: number): LogicData | undefined {
        return this.tilesById.get(id)?.logic;
    }

    static getTileVisual(id: number): VisualData | undefined {
        return this.tilesById.get(id)?.visual;
    }
    
    static getEntityLogic(type: string): LogicData | undefined {
        return this.entitiesByType.get(type)?.logic;
    }

    static getEntityVisual(type: string): VisualData | undefined {
        return this.entitiesByType.get(type)?.visual;
    }
    
    // Simple helper to fetch the raw array for the server
    static getTilesExport() {
        return tilesRegistryData;
    }
    
    static getEntitiesExport() {
        return entitiesRegistryData;
    }
}

// Auto-initialize when imported
RegistryManager.init();
