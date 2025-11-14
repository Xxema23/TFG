// src/components/simulator/DetailTablesPanel/utils/SmartCache.ts
class SmartCache {
  private cache = new Map<string, any>();
  private timestamps = new Map<string, number>();
  private TTL = 5 * 60 * 1000; // 5 minutos por defecto
  private isDevelopment: boolean;

  constructor() {
    // Detectar entorno de desarrollo de forma segura
    this.isDevelopment = typeof window !== 'undefined' && 
                        (location.hostname === 'localhost' ||
                         location.hostname === '127.0.0.1' ||
                         location.hostname.includes('dev') ||
                         import.meta.env?.DEV === true);
  }
  
  set(key: string, value: any, customTTL?: number): void {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + (customTTL || this.TTL));
    
    if (this.isDevelopment) {
      console.log(`💾 Cache SET: ${key} (TTL: ${(customTTL || this.TTL) / 1000}s)`);
    }
  }
  
  get(key: string): any {
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      
      if (this.isDevelopment) {
        console.log(`⏰ Cache EXPIRED: ${key}`);
      }
      return null;
    }
    
    if (this.isDevelopment) {
      console.log(`✅ Cache HIT: ${key}`);
    }
    
    return this.cache.get(key);
  }
  
  has(key: string): boolean {
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return false;
    }
    
    return this.cache.has(key);
  }
  
  invalidatePattern(pattern: string): void {
    let invalidatedCount = 0;
    
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        invalidatedCount++;
      }
    }
    
    if (this.isDevelopment) {
      console.log(`🗑️ Cache INVALIDATED: ${invalidatedCount} entries matching "${pattern}"`);
    }
  }
  
  invalidateKey(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.timestamps.delete(key);
    
    if (this.isDevelopment && existed) {
      console.log(`🗑️ Cache INVALIDATED: ${key}`);
    }
    
    return existed;
  }
  
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.timestamps.clear();
    
    if (this.isDevelopment) {
      console.log(`🧹 Cache CLEARED: ${size} entries removed`);
    }
  }
  
  cleanup(): number {
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [key, timestamp] of this.timestamps) {
      if (now > timestamp) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        cleanedCount++;
      }
    }
    
    if (this.isDevelopment && cleanedCount > 0) {
      console.log(`🧽 Cache CLEANUP: ${cleanedCount} expired entries removed`);
    }
    
    return cleanedCount;
  }
  
  getStats(): {
    size: number;
    keys: string[];
    expiredKeys: string[];
    totalMemoryUsage: number;
  } {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, timestamp] of this.timestamps) {
      if (now > timestamp) {
        expiredKeys.push(key);
      }
    }
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      expiredKeys,
      totalMemoryUsage: this.cache.size + this.timestamps.size
    };
  }
  
  // Método para obtener o establecer con función de factory
  getOrSet<T>(key: string, factory: () => T, customTTL?: number): T {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = factory();
    this.set(key, value, customTTL);
    return value;
  }
  
  // Método para obtener o establecer con función async
  async getOrSetAsync<T>(
    key: string, 
    factory: () => Promise<T>, 
    customTTL?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await factory();
    this.set(key, value, customTTL);
    return value;
  }
}

export const globalCache = new SmartCache();
export default SmartCache;