// src/services/simulatorServices.ts - VERSION OPTIMIZADA CON CACHE Y PALETS
import api from '../api';
import { 
  IWorkOrderBackend, 
  IWorkOrderColor, 
  IComponentAvailabilityBackend,
  IFilterDataBackend,
  IWorkOrderFrontend,
  IPalet // ✅ NUEVA importación
} from '../interfaces/ISimulatorData';
import { globalCache } from '../components/simulator/DetailTablesPanel/utils/SmartCache';

let processedKeys = new Set<string>();

/**
 * Mapea datos del backend al formato del frontend
 */
export const mapWorkOrderToFrontend = (wo: IWorkOrderBackend): IWorkOrderFrontend => {
  return {
    id: wo.NumWO,
    numWO: wo.NumWO,
    equipo: wo.Equipo,
    secuencia: wo.Secuencia,
    linea: wo.Linea,
    numDoc: wo.Numero_de_pedido || '',
    tipDoc: wo.Tipo_de_pedido || '',
    estadoWO: wo.Estado_WO.toString(),
    fchObjetivo: wo.Fch_Objetivo,
    fchAcuse: wo.Fch_Acuse || '',
    fchAlbarAn: wo.Fch_Albaran || '',
    importe: wo.Importe,
    cshTotal: parseFloat(wo.Horas_totales_de_la_WO) || 0
  };
};

/**
 * Obtiene todas las órdenes de trabajo con horas (CON CACHE)
 */
export const getWorkOrders = async (): Promise<IWorkOrderFrontend[]> => {
  const cacheKey = 'workOrders';
  
  // Intentar obtener del cache primero
  const cached = globalCache.get(cacheKey);
  if (cached) {
    console.log('📦 Usando work orders desde cache');
    return cached;
  }
  
  try {
    const response = await api.get<IWorkOrderBackend[]>('/fabricaciones-con-horas');
    
    if (!Array.isArray(response?.data)) {
      console.error('Estructura de respuesta inválida:', response);
      return [];
    }

    // Resetear el Set para cada carga de datos
    processedKeys = new Set<string>();
    
    const workOrders: IWorkOrderFrontend[] = [];
    
    response.data.forEach((wo, index) => {
      // Crear clave única usando múltiples campos
      const baseKey = `${wo.NumWO}-${wo.Fch_Objetivo}-${wo.Linea}-${wo.Secuencia}`;
      const uniqueKey = `${baseKey}-${index}`;
      
      // Solo procesar si no hemos visto esta clave antes
      if (!processedKeys.has(uniqueKey)) {
        processedKeys.add(uniqueKey);
        
        const mappedWO = mapWorkOrderToFrontend(wo);
        mappedWO.id = uniqueKey; // Usar la clave única como ID
        
        workOrders.push(mappedWO);
      }
    });
    
    // ✅ CACHE: Guardar en cache por 3 minutos
    globalCache.set(cacheKey, workOrders, 3 * 60 * 1000);
    console.log(`✅ Work orders cargadas y cacheadas: ${workOrders.length} WOs`);
    
    return workOrders;
  } catch (error) {
    console.error('Error al obtener órdenes de trabajo:', error);
    
    // En caso de error, intentar devolver datos del cache aunque estén expirados
    const expiredCache = globalCache.get(cacheKey + '_backup');
    if (expiredCache) {
      console.warn('⚠️ Usando datos del cache de respaldo debido a error');
      return expiredCache;
    }
    
    return [];
  }
};

/**
 * ✅ NUEVA: Obtiene todos los palets (CON CACHE)
 */
export const getPalets = async (): Promise<IPalet[]> => {
  const cacheKey = 'palets';
  
  // Intentar obtener del cache primero
  const cached = globalCache.get(cacheKey);
  if (cached) {
    console.log('📦 Usando palets desde cache');
    return cached;
  }
  
  try {
    const response = await api.get<IPalet[]>('/palets');
    
    if (!Array.isArray(response?.data)) {
      console.error('Estructura de respuesta inválida para palets:', response);
      return [];
    }

    const palets = response.data;

    // ✅ CACHE: Guardar en cache por 5 minutos
    globalCache.set(cacheKey, palets, 5 * 60 * 1000);
    console.log(`✅ Palets cargados y cacheados: ${palets.length} palets`);
    
    return palets;
  } catch (error) {
    console.error('Error al obtener palets:', error);
    return [];
  }
};

/**
 * ✅ NUEVA: Función para crear un mapa de palets por num_orden
 */
export const createPaletsMap = (palets: IPalet[]): Map<string, IPalet> => {
  const map = new Map<string, IPalet>();
  
  palets.forEach(palet => {
    if (palet.num_orden) {
      map.set(palet.num_orden, palet);
    }
  });
  
  console.log(`🗺️ Mapa de palets creado: ${map.size} palets mapeados`);
  return map;
};

/**
 * Obtiene los colores de las WOs según disponibilidad (CON CACHE)
 */
export const getWorkOrderColors = async (): Promise<Record<string, string>> => {
  const cacheKey = 'workOrderColors';
  
  // Intentar obtener del cache primero
  const cached = globalCache.get(cacheKey);
  if (cached) {
    console.log('📦 Usando colores desde cache');
    return cached;
  }
  
  try {
    const response = await api.get<IWorkOrderColor[]>('/colores-wo');
    
    if (!Array.isArray(response?.data)) {
      console.error('Estructura de respuesta inválida:', response);
      return {};
    }

    // Convertir array a objeto para fácil acceso
    const colorsMap: Record<string, string> = {};
    response.data.forEach(item => {
      colorsMap[item.wo] = item.color;
    });

    // ✅ CACHE: Guardar en cache por 5 minutos
    globalCache.set(cacheKey, colorsMap, 5 * 60 * 1000);
    console.log(`✅ Colores cargados y cacheados: ${Object.keys(colorsMap).length} WOs`);
    
    return colorsMap;
  } catch (error) {
    console.error('Error al obtener colores de WO:', error);
    return {};
  }
};

/**
 * Obtiene las opciones de filtros dinámicas (CON CACHE)
 */
export const getFilterOptions = async () => {
  const cacheKey = 'filterOptions';
  
  // Intentar obtener del cache primero
  const cached = globalCache.get(cacheKey);
  if (cached) {
    console.log('📦 Usando opciones de filtro desde cache');
    return cached;
  }
  
  const defaultOptions = {
    numWO: [],
    numDoc: [],
    equipo: [],
    estadoWO: [],
    tipDoc: [],
    articulo: [],
    proveedor: []
  };
  
  try {
    const response = await api.get<IFilterDataBackend[]>('/filtros');
    
    if (!Array.isArray(response?.data)) {
      console.error('Estructura de respuesta inválida:', response);
      // ✅ CACHE: Cache por 1 minuto en caso de error
      globalCache.set(cacheKey, defaultOptions, 60 * 1000);
      return defaultOptions;
    }

    // Extraer opciones únicas para cada filtro
    const data = response.data;
    
    const options = {
      numWO: [...new Set(data.map(item => item.NumWO))].sort(),
      numDoc: [...new Set(data.map(item => item.NumDoc).filter(Boolean))].sort(),
      equipo: [...new Set(data.map(item => item.EquipoArticulo).filter(Boolean))].sort(),
      estadoWO: [...new Set(data.map(item => item.EstadoWO).filter(Boolean))].sort(),
      tipDoc: [...new Set(data.map(item => item.TipDoc).filter(Boolean))].sort(),
      articulo: [...new Set(data.map(item => item.Articulo).filter(Boolean))].sort(),
      proveedor: [...new Set(data.map(item => item.Proveedor).filter(Boolean))].sort()
    };
    
    // ✅ CACHE: Guardar en cache por 5 minutos
    globalCache.set(cacheKey, options, 5 * 60 * 1000);
    console.log('✅ Opciones de filtro cargadas y cacheadas');
    
    return options;
  } catch (error) {
    console.error('Error al obtener opciones de filtros:', error);
    
    // ✅ CACHE: Cache por 1 minuto en caso de error
    globalCache.set(cacheKey, defaultOptions, 60 * 1000);
    return defaultOptions;
  }
};

/**
 * Actualiza la fecha objetivo de una WO (INVALIDANDO CACHE)
 */
export const updateWorkOrderDate = async (woId: string, newDate: string): Promise<boolean> => {
  try {
    // Extraer el NumWO original del ID único
    const originalNumWO = woId.split('-')[0];
    
    await api.put(`/vision-fabricacion/${originalNumWO}`, {
      fch_objetivo: newDate
    });
    
    // ✅ INVALIDAR CACHE: Invalidar caches relacionados
    globalCache.invalidatePattern('workOrders');
    globalCache.invalidatePattern('filterOptions');
    globalCache.invalidatePattern('palets'); // ✅ Incluir palets
    
    console.log(`✅ Fecha actualizada para WO ${originalNumWO}: ${newDate}`);
    return true;
  } catch (error) {
    console.error('Error al actualizar fecha de WO:', error);
    return false;
  }
};

/**
 * Actualiza el orden de las WOs (INVALIDANDO CACHE)
 */
export const updateWorkOrderSequence = async (
  workOrders: { wo: string, secuencia: number }[]
): Promise<boolean> => {
  try {
    // Extraer NumWO original de cada ID único
    const updates = workOrders.map(item => ({
      wo: item.wo.split('-')[0], // Extraer NumWO original
      secuencia: item.secuencia
    }));
    
    console.log('Actualizando secuencias:', updates);
        
    // Simular delay del API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ✅ INVALIDAR CACHE: Invalidar cache de work orders
    globalCache.invalidatePattern('workOrders');
    globalCache.invalidatePattern('palets'); // ✅ Incluir palets
    
    console.log(`✅ Secuencias actualizadas: ${updates.length} WOs`);
    return true;
  } catch (error) {
    console.error('Error al actualizar secuencias de WO:', error);
    return false;
  }
};

/**
 * Obtiene la disponibilidad de componentes para las WOs (CON CACHE)
 */
export const getComponentAvailability = async (): Promise<Record<string, Record<string, any>>> => {
  const cacheKey = 'componentAvailability';
  
  // Intentar obtener del cache primero
  const cached = globalCache.get(cacheKey);
  if (cached) {
    console.log('📦 Usando disponibilidad de componentes desde cache');
    return cached;
  }
  
  try {

    const mockData: Record<string, Record<string, any>> = {};
    
    // ✅ CACHE: Cache por 2 minutos para datos mock
    globalCache.set(cacheKey, mockData, 2 * 60 * 1000);
    
    return mockData;
  } catch (error) {
    console.error('Error al obtener disponibilidad de componentes:', error);
    return {};
  }
};

/**
 * ✅ ACTUALIZADA: Función para invalidar todo el cache relacionado con work orders
 */
export const invalidateWorkOrderCache = () => {
  console.log('🗑️ Invalidando todo el cache de work orders...');
  globalCache.invalidatePattern('workOrders');
  globalCache.invalidatePattern('workOrderColors');
  globalCache.invalidatePattern('filterOptions');
  globalCache.invalidatePattern('componentAvailability');
  globalCache.invalidatePattern('palets'); // ✅ Incluir palets
};

/**
 * ✅ NUEVA: Función para obtener estadísticas del cache
 */
export const getCacheStats = () => {
  return globalCache.getStats();
};

/**
 * ✅ NUEVA: Función para limpiar todo el cache (útil para debugging)
 */
export const clearAllCache = () => {
  console.log('🧹 Limpiando todo el cache...');
  globalCache.clear();
};