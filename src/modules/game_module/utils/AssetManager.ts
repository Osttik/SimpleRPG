import spritesData from '../../../assets/sprites_data.json';
import tilesetUrl from '../../../assets/Tileset.png';
import heroUrl from '../../../assets/hero.png';
import decorationsUrl from '../../../assets/Decorations.png';
import chestsUrl from '../../../assets/chestsAll.png';

const assetMap: Record<string, string> = {
    'assets/Tileset.png': tilesetUrl,
    'assets/hero.png': heroUrl,
    'assets/Player_Base.png': heroUrl,
    'assets/Decorations.png': decorationsUrl,
    'assets/chestsAll.png': chestsUrl
};

// Create a map to cache our ImageBitmaps
const textureCache = new Map<string, ImageBitmap>();
// Create a map to store pending promises for requests happening simultaneously
const pendingRequests = new Map<string, Promise<ImageBitmap>>();

export class AssetManager {
    /**
     * Retrieves a texture as an ImageBitmap, loading it first if it's not cached.
     * @param sheetKey The key of the sheet defined in sprites_data.json
     * @returns Promise resolving to the ImageBitmap of the texture
     */
    static async getTexture(sheetKey: string): Promise<ImageBitmap> {
        // If it's already cached, return it immediately
        if (textureCache.has(sheetKey)) {
            return textureCache.get(sheetKey)!;
        }

        // If there's already a request to load this texture, wait for that instead of duplicating the request
        if (pendingRequests.has(sheetKey)) {
            return pendingRequests.get(sheetKey)!;
        }

        const sheets: any = (spritesData as any).sheets;
        const sheetInfo = sheets[sheetKey];
        
        if (!sheetInfo) {
            throw new Error(`Sheet ${sheetKey} not found in sprites_data.json`);
        }

        const url = sheetInfo.url;
        const resolvedUrl = assetMap[url];
        
        if (!resolvedUrl) {
            throw new Error(`AssetManager: URL '${url}' is not mapped in assetMap`);
        }
        
        const requestPromise = (async () => {
            try {
                // Fetch the resolved Vite asset URL
                const response = await fetch(resolvedUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to load texture ${resolvedUrl}: ${response.status} ${response.statusText}`);
                }
                
                const blob = await response.blob();
                const imgBitmap = await createImageBitmap(blob);
                
                textureCache.set(sheetKey, imgBitmap);
                pendingRequests.delete(sheetKey); // Cleanup
                
                return imgBitmap;
            } catch (error) {
                pendingRequests.delete(sheetKey);
                console.error(`AssetManager Error loading ${sheetKey}:`, error);
                throw error;
            }
        })();

        // Store the promise so subsequent requests wait for it instead of refetching
        pendingRequests.set(sheetKey, requestPromise);
        return requestPromise;
    }
    
    /**
     * Clear the existing cache.
     */
    static clearCache() {
        // Need to close ImageBitmaps to avoid memory leaks
        textureCache.forEach(bitmap => {
            if (bitmap.close) {
                bitmap.close();
            }
        });
        textureCache.clear();
        pendingRequests.clear();
    }
}
