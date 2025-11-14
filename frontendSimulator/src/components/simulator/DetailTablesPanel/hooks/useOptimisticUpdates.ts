// src/components/simulator/DetailTablesPanel/hooks/useOptimisticUpdates.ts
import { useState, useCallback, useRef, useEffect } from 'react';

interface PendingUpdate<T> {
  id: string;
  original: T;
  optimistic: T;
  timestamp: number;
  operation: string;
}

interface OptimisticOptions {
  timeout?: number;
  retries?: number;
  onRetry?: (attempt: number) => void;
}

export const useOptimisticUpdates = <T>() => {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PendingUpdate<T>>>(new Map());
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const rollbackTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryAttempts = useRef<Map<string, number>>(new Map());
  
  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      rollbackTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  const optimisticUpdate = useCallback(async (
    id: string,
    current: T,
    optimisticValue: T,
    apiCall: () => Promise<T>,
    operation: string = 'update',
    options: OptimisticOptions = {}
  ) => {
    const {
      timeout = 10000,
      retries = 0,
      onRetry
    } = options;
    
    // Limpiar error previo si existe
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    
    // Crear el update pendiente
    const update: PendingUpdate<T> = {
      id,
      original: current,
      optimistic: optimisticValue,
      timestamp: Date.now(),
      operation
    };
    
    setPendingUpdates(prev => new Map(prev).set(id, update));
    
    // Configurar rollback automático
    const timeoutId = setTimeout(() => {
      console.warn(`⚠️ Auto-rollback for ${id} after ${timeout}ms timeout`);
      rollback(id);
    }, timeout);
    
    rollbackTimeouts.current.set(id, timeoutId);
    
    const attemptUpdate = async (attempt: number = 0): Promise<T> => {
      try {
        const result = await apiCall();
        
        // Éxito: limpiar timeout y estado pendiente
        const timeoutRef = rollbackTimeouts.current.get(id);
        if (timeoutRef) {
          clearTimeout(timeoutRef);
          rollbackTimeouts.current.delete(id);
        }
        
        setPendingUpdates(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        
        retryAttempts.current.delete(id);
        
        console.log(`✅ Optimistic update succeeded for ${id} after ${attempt + 1} attempt(s)`);
        return result;
        
      } catch (error) {
        const currentAttempt = attempt + 1;
        
        if (currentAttempt <= retries) {
          console.log(`🔄 Retry ${currentAttempt}/${retries} for ${id}`);
          onRetry?.(currentAttempt);
          retryAttempts.current.set(id, currentAttempt);
          
          // Esperar antes del reintento (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return attemptUpdate(currentAttempt);
        }
        
        // Falló después de todos los reintentos
        console.error(`❌ Optimistic update failed for ${id} after ${currentAttempt} attempts:`, error);
        
        // Guardar error
        setErrors(prev => new Map(prev).set(id, error as Error));
        
        // Ejecutar rollback
        rollback(id);
        throw error;
      }
    };
    
    return attemptUpdate();
  }, []);
  
  const rollback = useCallback((id: string) => {
    const update = pendingUpdates.get(id);
    if (!update) return null;
    
    // Limpiar timeout si existe
    const timeoutId = rollbackTimeouts.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      rollbackTimeouts.current.delete(id);
    }
    
    // Remover de pendientes
    setPendingUpdates(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    
    // Limpiar reintentos
    retryAttempts.current.delete(id);
    
    console.log(`🔄 Rolled back optimistic update for ${id}`);
    return update.original;
  }, [pendingUpdates]);
  
  const clearErrors = useCallback(() => {
    setErrors(new Map());
  }, []);
  
  return {
    optimisticUpdate,
    rollback,
    clearErrors,
    pendingUpdates,
    errors,
    isPending: (id: string) => pendingUpdates.has(id),
    getError: (id: string) => errors.get(id),
    hasError: (id: string) => errors.has(id),
    retryCount: (id: string) => retryAttempts.current.get(id) || 0
  };
};