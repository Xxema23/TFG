import api from '../api';
import { CapacityData, BaseCapacity, DailyCapacity } from '../interfaces/Capacity';

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// ============================================
// CAPACIDADES BASE
// ============================================

/**
 * Obtener capacidades BASE de todas las líneas
 */
export const getBaseCapacities = async (scenarioId: number): Promise<BaseCapacity[]> => {
  try {
    const response = await api.get(`/scenarios/${scenarioId}/capacidades-base`);
    console.log('✅ [getBaseCapacities] Cargadas:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al obtener capacidades base:', error);
    return [];
  }
};

/**
 * Guardar múltiples capacidades BASE
 * @param capacities - Objeto { "S21": 10, "L14": 8 }
 */
export const saveBaseCapacities = async (
  scenarioId: number,
  capacities: Record<string, number>
): Promise<ApiResponse> => {
  try {
    const response = await api.post(`/scenarios/${scenarioId}/capacidades-base`, capacities);
    console.log('✅ [saveBaseCapacities] Guardadas:', response.data);
    return {
      success: true,
      message: response.data.message,
      data: response.data
    };
  } catch (error: any) {
    console.error('❌ Error al guardar capacidades base:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al guardar capacidades base'
    };
  }
};

// ============================================
// CAPACIDADES SEMANALES
// ============================================

/**
 * Obtener capacidades SEMANALES de un año
 */
export const getCapacities = async (
  scenarioId: number,
  year: number,
  week?: number
): Promise<CapacityData[]> => {
  try {
    const params: any = { year };
    if (week !== undefined) {
      params.week = week;
    }

    const response = await api.get(`/scenarios/${scenarioId}/capacidades-semanales`, { params });
    console.log(`✅ [getCapacities] Año ${year}:`, response.data.length, 'capacidades');
    return response.data;
  } catch (error) {
    console.error('❌ Error al obtener capacidades semanales:', error);
    return [];
  }
};

/**
 * Guardar múltiples capacidades SEMANALES
 */
export const saveCapacities = async (
  scenarioId: number,
  capacities: CapacityData[]
): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(capacities) || capacities.length === 0) {
      return {
        success: true,
        message: 'No hay capacidades semanales para guardar.',
        data: []
      };
    }

    const response = await api.post(`/scenarios/${scenarioId}/capacidades-semanales`, capacities);
    console.log('✅ [saveCapacities] Guardadas:', response.data);
    
    return {
      success: true,
      message: response.data.message,
      data: response.data
    };
  } catch (error: any) {
    console.error('❌ Error al guardar capacidades semanales:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al guardar capacidades semanales'
    };
  }
};

/**
 * Eliminar múltiples capacidades SEMANALES
 */
export const deleteCapacities = async (
  scenarioId: number,
  deletions: { line: string; week: number; year: number }[]
): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(deletions) || deletions.length === 0) {
      return {
        success: true,
        message: 'No hay capacidades para eliminar.',
        data: []
      };
    }

    const response = await api.delete(`/scenarios/${scenarioId}/capacidades-semanales`, {
      data: deletions
    });
    
    console.log('✅ [deleteCapacities] Eliminadas:', response.data);
    
    return {
      success: true,
      message: response.data.message,
      data: response.data
    };
  } catch (error: any) {
    console.error('❌ Error al eliminar capacidades semanales:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error al eliminar capacidades semanales'
    };
  }
};

// ============================================
// LÓGICA HÍBRIDA
// ============================================

/**
 * Helper: Calcular número de semana ISO
 */
export const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

/**
 * Construir capacidades diarias con lógica HÍBRIDA
 * 
 * REGLA: Si existe capacidad semanal específica → usar esa
 *        Si NO existe → usar capacidad base de la línea
 */
export const buildDailyCapacities = (
  baseCapacities: BaseCapacity[],
  weeklyCapacities: CapacityData[],
  workingDays: string[]
): DailyCapacity[] => {
  
  console.log('🏗️ [buildDailyCapacities] Iniciando construcción híbrida...');
  console.log(`   📊 Capacidades BASE: ${baseCapacities.length}`);
  console.log(`   📊 Capacidades SEMANALES: ${weeklyCapacities.length}`);
  console.log(`   📊 Días laborables: ${workingDays.length}`);
  
  const result: DailyCapacity[] = [];
  
  // Crear mapa de capacidades base
  const baseMap = new Map<string, number>();
  baseCapacities.forEach(cap => {
    baseMap.set(cap.line, cap.daily_capacity);
  });
  
  // Crear mapa de capacidades semanales
  const weeklyMap = new Map<string, number>();
  weeklyCapacities.forEach(cap => {
    const key = `${cap.line}-${cap.week}-${cap.year}`;
    weeklyMap.set(key, cap.value);
  });
  
  // Para cada día laborable
  workingDays.forEach(day => {
    const date = new Date(day);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    
    // Para cada línea
    baseCapacities.forEach(baseCap => {
      const line = baseCap.line;
      const weekKey = `${line}-${week}-${year}`;
      
      // ⬇️⬇️⬇️ LÓGICA HÍBRIDA ⬇️⬇️⬇️
      const capacity = weeklyMap.has(weekKey)
        ? weeklyMap.get(weekKey)!      // Usar específica si existe
        : baseMap.get(line)!;          // Usar base si no existe
      // ⬆️⬆️⬆️ FIN LÓGICA HÍBRIDA ⬆️⬆️⬆️
      
      result.push({ line, date: day, capacity });
    });
  });
  
  console.log(`✅ [buildDailyCapacities] Generadas ${result.length} capacidades diarias`);
  
  return result;
};

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

export const clearAllCapacities = (): void => {
  console.log('🗑️ clearAllCapacities no hace nada (datos en backend)');
};

export const debugStorage = (): void => {
  console.log('🔍 debugStorage no hace nada (datos en backend)');
};