// src/components/simulator/DetailTablesPanel/hooks/UseFuzzySearch.ts
import { useMemo, useCallback, useState, useEffect } from 'react';

// Versión simplificada de fuzzy search (sin dependencia de Fuse.js)
interface FuseResult<T> {
  item: T;
  score?: number;
}

interface FuseOptions<T> {
  keys: string[];
  threshold?: number;
  includeScore?: boolean;
  minMatchCharLength?: number;
}

class SimpleFuse<T> {
  private data: T[];
  private options: FuseOptions<T>;
  
  constructor(data: T[], options: FuseOptions<T>) {
    this.data = data;
    this.options = {
      threshold: 0.3,
      includeScore: false,
      minMatchCharLength: 2,
      ...options
    };
  }
  
  search(pattern: string): FuseResult<T>[] {
    if (!pattern || pattern.length < (this.options.minMatchCharLength || 2)) {
      return this.data.map(item => ({ item }));
    }
    
    const results: FuseResult<T>[] = [];
    const lowerPattern = pattern.toLowerCase();
    
    this.data.forEach(item => {
      let bestScore = 1;
      let hasMatch = false;
      
      this.options.keys.forEach(key => {
        const value = this.getNestedValue(item, key);
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          
          // Busqueda exacta
          if (lowerValue.includes(lowerPattern)) {
            hasMatch = true;
            const score = 1 - (lowerPattern.length / lowerValue.length);
            bestScore = Math.min(bestScore, score);
          }
          // Busqueda fuzzy simple
          else if (this.fuzzyMatch(lowerValue, lowerPattern)) {
            hasMatch = true;
            bestScore = Math.min(bestScore, 0.5);
          }
        }
      });
      
      if (hasMatch && bestScore <= this.options.threshold!) {
        results.push(
          this.options.includeScore 
            ? { item, score: bestScore }
            : { item }
        );
      }
    });
    
    // Ordenar por score si está incluido
    if (this.options.includeScore) {
      results.sort((a, b) => (a.score || 0) - (b.score || 0));
    }
    
    return results;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  private fuzzyMatch(text: string, pattern: string): boolean {
    const textLen = text.length;
    const patternLen = pattern.length;
    
    if (patternLen > textLen) return false;
    if (patternLen === textLen) return text === pattern;
    
    let textindex = 0;
    let patternindex = 0;
    
    while (textindex < textLen && patternindex < patternLen) {
      if (text[textindex] === pattern[patternindex]) {
        patternindex++;
      }
      textindex++;
    }
    
    return patternindex === patternLen;
  }
}

export const UseFuzzySearch = <T>(
  data: T[], 
  keys: string[], 
  options?: Partial<FuseOptions<T>>
) => {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const fuse = useMemo(() => {
    const defaultOptions: FuseOptions<T> = {
      keys,
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
      ...options
    };
    
    return new SimpleFuse(data, defaultOptions);
  }, [data, keys, options]);
  
  const search = useCallback((pattern: string): T[] => {
    if (!pattern || pattern.length < 2) return data;
    
    // Guardar en historial
    setSearchHistory(prev => {
      const updated = [pattern, ...prev.filter(p => p !== pattern)];
      return updated.slice(0, 10); // Mantener últimas 10 búsquedas
    });
    
    const results = fuse.search(pattern);
    return results.map(result => result.item);
  }, [fuse, data]);
  
  const searchWithScores = useCallback((pattern: string) => {
    if (!pattern || pattern.length < 2) {
      return data.map(item => ({ item, score: 0 }));
    }
    
    return fuse.search(pattern).map(result => ({
      item: result.item,
      score: result.score || 0
    }));
  }, [fuse, data]);
  
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);
  
  return { 
    search, 
    searchWithScores,
    searchHistory,
    clearHistory
  };
};

// Hook con debounce
export const useDebouncedFuzzySearch = <T>(
  data: T[],
  keys: string[],
  delay: number = 300,
  options?: Partial<FuseOptions<T>>
) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const { search, searchWithScores, ...otherMethods } = UseFuzzySearch(data, keys, options);
  
  // Debounce el término de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setIsSearching(false);
    }, delay);
    
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    }
    
    return () => clearTimeout(timer);
  }, [searchTerm, delay, debouncedSearchTerm]);
  
  const results = useMemo(() => {
    return search(debouncedSearchTerm);
  }, [search, debouncedSearchTerm]);
  
  const updateSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);
  
  return {
    searchTerm,
    updateSearchTerm,
    results,
    isSearching,
    searchWithScores: useCallback((term?: string) => {
      return searchWithScores(term || debouncedSearchTerm);
    }, [searchWithScores, debouncedSearchTerm]),
    ...otherMethods
  };
};