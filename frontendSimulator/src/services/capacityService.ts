import api from '../api';
import { CapacityData, BaseCapacity, DailyCapacity } from '../interfaces/Capacity';

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export const getBaseCapacities = async (scenarioId: number): Promise<BaseCapacity[]> => {
  try {
    const response = await api.get(`/scenarios/${scenarioId}/capacidades-base`);
    return response.data;
  } catch (error) {
    console.error('❌ Error al obtener capacidades base:', error);
    return [];
  }
};

export const saveBaseCapacities = async (
  scenarioId: number,
  capacities: Record<string, number>
): Promise<ApiResponse> => {
  try {
    const response = await api.post(`/scenarios/${scenarioId}/capacidades-base`, capacities);
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
    return response.data;
  } catch (error) {
    console.error('❌ Error al obtener capacidades semanales:', error);
    return [];
  }
};

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

export const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

export const buildDailyCapacities = (
  baseCapacities: BaseCapacity[],
  weeklyCapacities: CapacityData[],
  workingDays: string[]
): DailyCapacity[] => {
  const result: DailyCapacity[] = [];
  
  const baseMap = new Map<string, number>();
  baseCapacities.forEach(cap => {
    baseMap.set(cap.line, cap.daily_capacity);
  });
  
  const weeklyMap = new Map<string, number>();
  weeklyCapacities.forEach(cap => {
    const key = `${cap.line}-${cap.week}-${cap.year}`;
    weeklyMap.set(key, cap.value);
  });
  
  workingDays.forEach(day => {
    const date = new Date(day);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    
    baseCapacities.forEach(baseCap => {
      const line = baseCap.line;
      const weekKey = `${line}-${week}-${year}`;
      
      const capacity = weeklyMap.has(weekKey)
        ? weeklyMap.get(weekKey)!
        : baseMap.get(line)!;
      
      result.push({ line, date: day, capacity });
    });
  });
  
  return result;
};

export const clearAllCapacities = (): void => {
  // No-op: datos en backend
};

export const debugStorage = (): void => {
  // No-op: datos en backend
};