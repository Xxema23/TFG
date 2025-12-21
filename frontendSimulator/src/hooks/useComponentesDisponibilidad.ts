import { useState, useEffect, useMemo } from 'react';
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
  
  // 🔄 Función para cargar datos
  const loadComponentes = async () => {
    // Si no está habilitado o no hay WOs, no cargar
    if (!enabled || numWOs.length === 0) {
      console.log('⏸️ [useComponentesDisponibilidad] Carga deshabilitada o sin WOs');
      setComponentes([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [useComponentesDisponibilidad] Cargando componentes para', numWOs.length, 'WOs');
      
      const data = await getComponentesDisponibilidad({
        wos: numWOs,
        limit
      });
      
      setComponentes(data);
      
      console.log('✅ [useComponentesDisponibilidad] Componentes cargados:', data.length);
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido');
      setError(error);
      console.error('❌ [useComponentesDisponibilidad] Error:', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 🎯 Efecto para cargar datos cuando cambian los NumWOs
  useEffect(() => {
    loadComponentes();
  }, [JSON.stringify(numWOs), enabled, limit]); // JSON.stringify para comparación profunda
  
  // 📊 Transformar datos para ComponentsTable (memoizado)
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