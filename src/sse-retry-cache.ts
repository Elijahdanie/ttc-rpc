import { TTCSSEEventData } from "./sse";
import fs from 'fs';



export class SSERetryCache {
    filePath = 'sse-cache.json';
    retryCache: Map<string, Set<TTCSSEEventData>>
    constructor() {
        this.retryCache = this.loadFile();
        // Clean up expired cache every 10 minutes
        setInterval(() => {
            this.cleanExpiredCache();
        }, 5 * 60 * 1000);
    }

    cleanExpiredCache = () => {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        for (const [clientId, eventSet] of this.retryCache.entries()) {
            const originalSize = eventSet.size;
            
            // Filter out expired events
            for (const event of eventSet) {
                if (now - event.eta > maxAge) {
                    eventSet.delete(event);
                }
            }
            
            // Remove empty sets
            if (eventSet.size === 0) {
                this.retryCache.delete(clientId);
            } else if (eventSet.size !== originalSize) {
                // Update if events were removed
                this.retryCache.set(clientId, eventSet);
            }
        }
        
        // Save changes to file
        this.saveFile(this.retryCache);
    }

    cache = (_scid: string, event: TTCSSEEventData) => {
        let cachedSet = this.retryCache.get(_scid);
        if (!cachedSet) {
            cachedSet = new Set<TTCSSEEventData>()
        }

        // Check for duplicates using Set's built-in uniqueness
        // Since Set uses reference equality, we need to check manually
        // Create a composite key for comparison
        const eventKey = `${event.event}:${JSON.stringify(event.data)}`;
        for (const existingEvent of cachedSet) {
            const existingKey = `${existingEvent.event}:${JSON.stringify(existingEvent.data)}`;
            if (eventKey === existingKey) {
                return; // Duplicate found, don't add
            }
        }

        cachedSet.add(event);
        this.retryCache.set(_scid, cachedSet);
        this.saveFile(this.retryCache);
    }

    loadFile(): Map<string, Set<TTCSSEEventData>> {
        if (fs.existsSync(this.filePath)) {
            try {
                const cacheFile = fs.readFileSync(this.filePath, 'utf-8');
                const cacheData = JSON.parse(cacheFile);
                
                // Convert back to Map<Set> structure
                const map = new Map<string, Set<TTCSSEEventData>>();
                for (const [key, value] of Object.entries(cacheData)) {
                    map.set(key, new Set(value as TTCSSEEventData[]));
                }
                return map;
            } catch (error) {
                console.error('[SSERetryCache] Error loading cache file:', error);
                return new Map<string, Set<TTCSSEEventData>>();
            }
        } else {
            return new Map<string, Set<TTCSSEEventData>>();
        }
    }

    saveFile(cache: Map<string, Set<TTCSSEEventData>>) {
        // Convert Map to serializable format
        const serializable = {};
        for (const [key, value] of cache.entries()) {
            serializable[key] = Array.from(value);
        }
        fs.writeFileSync(this.filePath, JSON.stringify(serializable, null, 2));
    }

    get = (_scid: string): Set<TTCSSEEventData> => {
        const data = this.retryCache;
        return data.get(_scid);
    }

    delete = (_scid: string) => {
        setTimeout(() => {
            const data = this.retryCache;
            data.delete(_scid);
            this.saveFile(data);
        }, 3000);
    }
}

export const SSECache = new SSERetryCache();