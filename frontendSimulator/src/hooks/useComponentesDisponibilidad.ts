import { useState, useEffect, useMemo, useRef } from 'react';
import { IComponenteDisponibilidad } from '../interfaces/IComponenteDisponibilidad';
import { getComponentesDisponibilidad, transformComponentesData } from '../services/componentesService';

interface UseComponentesDisponibilidadParams {
  numWOs: string[];           // Array de NumWOs a consultar
  enabled?: boolean;          // Si está habilitado (para lazy loading)
  limit?: number;             // Límite de artículos por WO
}

interface UseComponentesDisponibilidadReturn {
  // Datos
  componentes: IComponenteDisponibilidad[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, {
    disponible: number;
    fecha_entrega: string | null;
    formatted_value: string;
  }>>;
  
  // Estados
  isLoading: boolean;
  error: Error | null;
  
  // Acciones
  refetch: () => Promise<void>;
}

/**
 * Hook para gestionar la disponibilidad de componentes
 * 
 * @param params - Parámetros del hook (numWOs, enabled, limit)
 * @returns Estado y funciones para gestionar componentes
 */

export const useComponentesDisponibilidad = ({
  numWOs,
  enabled = true,
  limit = 10
}: UseComponentesDisponibilidadParams): UseComponentesDisponibilidadReturn => {
  
  const [componentes, setComponentes] = useState<IComponenteDisponibilidad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ OPTIMIZACIÓN 1: Ref para tracking de requests en vuelo
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ✅ OPTIMIZACIÓN 2: Signature ESTABLE para evitar re-fetches innecesarios
  const numWOsSignature = useMemo(() => {
    if (numWOs.length === 0) return '';
    
    // Crear signature basada en contenido real, no en referencia del array
    // Solo cambia si los NumWOs realmente cambian
    return [...numWOs].sort().join(',');
  }, [
    numWOs.length,                      // Cambia si agregan/quitan WOs
    numWOs[0],                          // Cambia si primera WO es diferente
    numWOs[numWOs.length - 1]           // Cambia si última WO es diferente
  ]);
  
  // 🔄 Función para cargar datos
  const loadComponentes = async () => {
    // Si no está habilitado o no hay WOs, no cargar
    if (!enabled || numWOs.length === 0) {
      console.log('⏸️ [useComponentesDisponibilidad] Carga deshabilitada o sin WOs');
      setComponentes([]);
      return;
    }
    
    // ✅ OPTIMIZACIÓN 3: Cancelar request anterior si existe
    if (abortControllerRef.current) {
      console.log('🚫 [useComponentesDisponibilidad] Cancelando request anterior');
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController para este request
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [useComponentesDisponibilidad] Cargando componentes para', numWOs.length, 'WOs');
      console.log('🔑 [useComponentesDisponibilidad] Signature:', numWOsSignature.substring(0, 50) + '...');
      
      const data = await getComponentesDisponibilidad({
        wos: numWOs,
        limit
      });
      
      // ✅ Verificar si el request fue cancelado
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🚫 [useComponentesDisponibilidad] Request cancelado, ignorando resultado');
        return;
      }
      
      setComponentes(data);
      
      console.log('✅ [useComponentesDisponibilidad] Componentes cargados:', data.length);
      
    } catch (err) {
      // ✅ Ignorar errores de cancelación
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('🚫 [useComponentesDisponibilidad] Request abortado');
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
  
  // 🎯 OPTIMIZACIÓN 4: useEffect con signature estable y cleanup
  useEffect(() => {
    console.log('🔄 [useComponentesDisponibilidad] Effect triggered:', {
      signature: numWOsSignature.substring(0, 50) + '...',
      enabled,
      limit,
      numWOsLength: numWOs.length
    });
    
    loadComponentes();
    
    // ✅ Cleanup: cancelar request si componente se desmonta o signature cambia
    return () => {
      if (abortControllerRef.current) {
        console.log('🧹 [useComponentesDisponibilidad] Cleanup: cancelando request');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [numWOsSignature, enabled, limit]); // ✅ Dependencies optimizadas
  
  // 📊 Transformar datos para ComponentsTable (memoizado)
  const { availableComponents, componentAvailability } = useMemo(() => {
    if (componentes.length === 0) {
      return {
        availableComponents: [],
        componentAvailability: {}
      };
    }
    
    console.log('🔄 [useComponentesDisponibilidad] Transformando datos:', componentes.length);
    
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