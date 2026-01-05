import { useState, useEffect, useMemo, useRef } from 'react';
import { IComponenteDisponibilidad } from '../interfaces/IComponenteDisponibilidad';
import { getComponentesDisponibilidad, transformComponentesData } from '../services/componentesService';

interface UseComponentesDisponibilidadParams {
  numWOs: string[];
  enabled?: boolean;
  limit?: number;
}

interface UseComponentesDisponibilidadReturn {
  componentes: IComponenteDisponibilidad[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, {
    disponible: number;
    fecha_entrega: string | null;
    formatted_value: string;
  }>>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useComponentesDisponibilidad = ({
  numWOs,
  enabled = true,
  limit = 10
}: UseComponentesDisponibilidadParams): UseComponentesDisponibilidadReturn => {
  
  const [componentes, setComponentes] = useState<IComponenteDisponibilidad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const numWOsSignature = useMemo(() => {
    if (numWOs.length === 0) return '';
    return [...numWOs].sort().join(',');
  }, [
    numWOs.length,
    numWOs[0],
    numWOs[numWOs.length - 1]
  ]);
  
  const loadComponentes = async () => {
    if (!enabled || numWOs.length === 0) {
      setComponentes([]);
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getComponentesDisponibilidad({
        wos: numWOs,
        limit
      });
      
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      setComponentes(data);
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const error = err instanceof Error ? err : new Error('Error desconocido');
      setError(error);
      console.error('❌ [useComponentesDisponibilidad] Error:', error.message);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  useEffect(() => {
    loadComponentes();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [numWOsSignature, enabled, limit]);
  
  const { availableComponents, componentAvailability } = useMemo(() => {
    if (componentes.length === 0) {
      return {
        availableComponents: [],
        componentAvailability: {}
      };
    }
    
    return transformComponentesData(componentes);
  }, [componentes]);
  
  return {
    componentes,
    availableComponents,
    componentAvailability,
    isLoading,
    error,
    refetch: loadComponentes
  };
};