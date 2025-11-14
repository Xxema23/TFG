// src/components/simulator/DetailTablesPanel/hooks/UseSmartCache.ts
import { useRef, useCallback, useEffect } from 'react';
import { globalCache } from '../utils/SmartCache';

export const UseSmartCache = () => {
  const cacheRef = useRef(globalCache);
  
  const getCached = useCallback(async <T>(
    key: string, 
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> => {
    const cached = cacheRef.current.get(key);
    
    if (cached) {
      return cached;
    }
    
    console.log(`📦 Cache MISS: ${key} - fetching from source...`);
    const result = await factory();
    cacheRef.current.set(key, result, ttl);
    return result;
  }, []);
  
  const invalidate = useCallback((pattern: string) => {
    cacheRef.current.invalidatePattern(pattern);
  }, []);
  
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  const getStats = useCallback(() => {
    return cacheRef.current.getStats();
  }, []);
  
  // Limpiar cache expirado periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = cacheRef.current.getStats();
      stats.expiredKeys.forEach(key => {
        cacheRef.current.get(key); // Esto eliminará los expirados
      });
    }, 60000); // Cada minuto
    
    return () => clearInterval(interval);
  }, []);
  
  return { getCached, invalidate, clearCache, getStats };
};