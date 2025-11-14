import { CapacityData } from '../interfaces/Capacity';

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class CapacityStorage {
  private static instance: CapacityStorage;
  private storage: Map<string, CapacityData> = new Map();

  private constructor() {}

  public static getInstance(): CapacityStorage {
    if (!CapacityStorage.instance) {
      CapacityStorage.instance = new CapacityStorage();
    }
    return CapacityStorage.instance;
  }

  public setItem(key: string, value: CapacityData): void {
    this.storage.set(key, value);
  }

  public getItem(key: string): CapacityData | null {
    return this.storage.get(key) || null;
  }

  public removeItem(key: string): void {
    this.storage.delete(key);
  }

  public getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }

  public clear(): void {
    this.storage.clear();
  }

  public size(): number {
    return this.storage.size;
  }

  public getAllData(): Map<string, CapacityData> {
    return new Map(this.storage);
  }
}

const capacityStorage = CapacityStorage.getInstance();

const CAPACITY_KEY_PREFIX = 'capacity_';

export const saveCapacity = async (
  scenarioId: number,
  capacity: CapacityData
): Promise<ApiResponse> => {
  try {
    if (!capacity.line || capacity.week <= 0 || capacity.year <= 0) {
      throw new Error('Datos de capacidad inválidos');
    }

    const key = `${CAPACITY_KEY_PREFIX}${scenarioId}_${capacity.line}_${capacity.week}_${capacity.year}`;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    capacityStorage.setItem(key, {
      ...capacity,
      value: Math.max(0, capacity.value),
      week: Math.max(1, capacity.week),
      year: capacity.year
    });
    
    return {
      success: true,
      message: 'Capacidad guardada correctamente',
      data: capacity
    };
  } catch (error: any) {
    console.error('Error al guardar la capacidad:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al guardar la capacidad'
    };
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
        message: 'No hay capacidades para guardar.',
        data: []
      };
    }

    const results = [];
    const errors = [];
    
    for (const capacity of capacities) {
      try {
        if (!capacity.line || capacity.week <= 0 || capacity.year <= 0) {
          throw new Error(`Datos inválidos: línea=${capacity.line}, semana=${capacity.week}, año=${capacity.year}`);
        }

        if (capacity.value > 0) {
          const response = await saveCapacity(scenarioId, capacity);
          
          if (response.success) {
            results.push(response.data);
          } else {
            throw new Error(response.message || 'Error al guardar capacidad');
          }
        }
      } catch (err: any) {
        console.error(`Error al guardar capacidad (${capacity.line}, semana ${capacity.week}):`, err);
        errors.push({
          capacity,
          error: err.message
        });
      }
    }
    
    if (errors.length > 0) {
      const successMessage = results.length > 0 
        ? `Se guardaron ${results.length} de ${capacities.length} capacidades.` 
        : 'No se pudo guardar ninguna capacidad.';
        
      return {
        success: results.length > 0,
        message: `${successMessage} ${errors.length} errores encontrados.`,
        data: {
          results,
          errors,
          summary: {
            total: capacities.length,
            successful: results.length,
            failed: errors.length
          }
        }
      };
    }
    
    if (results.length === 0) {
      return {
        success: true,
        message: 'No se guardaron capacidades (todas tenían valor 0 o no había datos válidos para guardar).',
        data: {
          results: [],
          summary: {
            total: capacities.length,
            successful: 0,
            failed: 0,
            skipped: capacities.length
          }
        }
      };
    }
    
    return {
      success: true,
      message: `Se guardaron ${results.length} capacidades correctamente.`,
      data: {
        results,
        summary: {
          total: capacities.length,
          successful: results.length,
          failed: 0
        }
      }
    };
  } catch (error: any) {
    console.error('Error general al guardar capacidades:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al guardar capacidades'
    };
  }
};

export const getCapacities = async (
  scenarioId: number,
  year: number,
  week?: number
): Promise<CapacityData[]> => {
  try {
    const capacities: CapacityData[] = [];
    const prefix = `${CAPACITY_KEY_PREFIX}${scenarioId}_`;
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const allKeys = capacityStorage.getAllKeys();
    
    const matchingKeys = allKeys.filter(key => key.startsWith(prefix));
    
    for (const key of matchingKeys) {
      try {
        const capacity = capacityStorage.getItem(key);
        if (capacity) {
          if (capacity.year === year && (week === undefined || capacity.week === week)) {
            capacities.push(capacity);
          }
        }
      } catch (err) {
        console.error('Error al procesar capacidad con clave:', key, err);
      }
    }
    
    return capacities;
  } catch (error) {
    console.error('Error al obtener capacidades:', error);
    return [];
  }
};

export const deleteCapacity = async (
  scenarioId: number,
  line: string,
  week: number,
  year: number = new Date().getFullYear()
): Promise<ApiResponse> => {
  try {
    const key = `${CAPACITY_KEY_PREFIX}${scenarioId}_${line}_${week}_${year}`;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const existingCapacity = capacityStorage.getItem(key);
    if (existingCapacity) {
      capacityStorage.removeItem(key);
      return {
        success: true,
        message: 'Capacidad eliminada correctamente',
        data: existingCapacity
      };
    } else {
      return {
        success: false,
        message: 'No se encontró la capacidad para eliminar'
      };
    }
  } catch (error: any) {
    console.error('Error al eliminar la capacidad:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al eliminar la capacidad'
    };
  }
};

export const getStorageStats = (): {
  totalCapacities: number;
  byScenario: Record<number, number>;
  byLine: Record<string, number>;
} => {
  const allData = capacityStorage.getAllData();
  const stats = {
    totalCapacities: allData.size,
    byScenario: {} as Record<number, number>,
    byLine: {} as Record<string, number>
  };

  capacityStorage.getAllKeys().forEach(key => {
    const parts = key.replace(CAPACITY_KEY_PREFIX, '').split('_');
    if (parts.length >= 3) {
      const scenarioId = parseInt(parts[0]);
      const line = parts[1];
      
      if (!isNaN(scenarioId)) {
        stats.byScenario[scenarioId] = (stats.byScenario[scenarioId] || 0) + 1;
      }
      
      if (line) {
        stats.byLine[line] = (stats.byLine[line] || 0) + 1;
      }
    }
  });

  return stats;
};

export const clearAllCapacities = (): void => {
  capacityStorage.clear();
};

export const debugStorage = (): void => {
  console.group('Debug del almacenamiento de capacidades');
  console.log('Total de elementos:', capacityStorage.size());
  console.log('Todas las claves:', capacityStorage.getAllKeys());
  console.log('Todos los datos:', capacityStorage.getAllData());
  console.log('Estadísticas:', getStorageStats());
  console.groupEnd();
};