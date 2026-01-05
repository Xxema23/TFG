import axios from 'axios';
import { IComponenteDisponibilidad, ComponenteDisponibilidadParams } from '../interfaces/IComponenteDisponibilidad';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ✅ CACHÉ DE CÁLCULOS SECUENCIALES
interface CacheEntry {
  signature: string;
  result: IComponenteDisponibilidad[];
  timestamp: number;
}

const calculoCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 segundos

// Limpiar caché expirado cada minuto
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of calculoCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      calculoCache.delete(key);
      // Log silenciado: console.log('🗑️ [Cache] Entrada expirada eliminada:', key.substring(0, 50) + '...');
    }
  }
}, 60000);

/**
 * Obtiene la disponibilidad de componentes para las WOs especificadas
 * 
 * @param params - Parámetros de la petición (wos, limit)
 * @returns Promise con array de disponibilidades de componentes
 */
export const getComponentesDisponibilidad = async (
  params: ComponenteDisponibilidadParams = {}
): Promise<IComponenteDisponibilidad[]> => {
  try {
    // Log silenciado: console.log('🔍 [ComponentesService] Llamando API con params:', params);
    
    // Usar POST para enviar array de WOs (más seguro que GET con query params)
    const response = await axios.post<IComponenteDisponibilidad[]>(
      `${API_BASE_URL}/api/colores-wo-disponible`,
      {
        wos: params.wos || [],
        limit: params.limit || 10
      }
    );
    
    // Log silenciado: console.log('✅ [ComponentesService] Datos recibidos:', {...});
    
    return response.data;
    
  } catch (error) {
    console.error('❌ [ComponentesService] Error al obtener disponibilidad:', error);
    
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Error de API: ${error.response?.status} - ${error.response?.statusText || error.message}`
      );
    }
    
    throw error;
  }
};

/**
 * ✅ OPTIMIZADO: Calcula consumo secuencial por línea CON CACHÉ
 * 
 * @param componentes - Array de componentes desde la API
 * @param workOrders - Work orders ordenadas visualmente (de arriba a abajo)
 * @returns Componentes con disponible recalculado según consumo secuencial
 */
export const calcularConsumoSecuencial = (
  componentes: IComponenteDisponibilidad[],
  workOrders: { numWO: string; linea: string }[]
): IComponenteDisponibilidad[] => {
  
  // ✅ CREAR SIGNATURE DEL CÁLCULO
  const signature = `${componentes.length}-${workOrders.map(w => `${w.numWO}:${w.linea}`).join('|')}`;
  
  // ✅ VERIFICAR CACHÉ
  const cached = calculoCache.get(signature);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    // Log silenciado: console.log('⚡ [calcularConsumoSecuencial] Usando CACHÉ:', {...});
    return cached.result;
  }
  
  // Log silenciado: console.log('🔢 [calcularConsumoSecuencial] INICIO:', {...});

  // ✅ Eliminar duplicados por WO + item_code
  const componentesUnicos = componentes.filter((comp, index, self) => 
    index === self.findIndex((c) => 
      c.wo === comp.wo && c.item_code === comp.item_code
    )
  );

  // Log silenciado: console.log('🔍 [calcularConsumoSecuencial] Componentes únicos:', {...});

  // 1. Agrupar WOs por línea (manteniendo el orden)
  const wosByLinea = new Map<string, string[]>();
  
  workOrders.forEach(wo => {
    if (!wosByLinea.has(wo.linea)) {
      wosByLinea.set(wo.linea, []);
    }
    wosByLinea.get(wo.linea)!.push(wo.numWO);
  });

  // Log silenciado: console.log('📊 [calcularConsumoSecuencial] WOs por línea:', {...});

  // 2. Para cada línea, calcular consumo secuencial
  const componentesActualizados: IComponenteDisponibilidad[] = [];

  wosByLinea.forEach((wosEnLinea, linea) => {
    // Log silenciado: console.log(`\n🏭 [Línea ${linea}] Procesando ${wosEnLinea.length} WOs...`);
    
    // Mapa de stock disponible por componente en esta línea
    // Inicialmente = stock_global
    const stockPorComponente = new Map<string, number>();
    
    // 3. Inicializar stock para todos los componentes de esta línea
    componentesUnicos.forEach(comp => {
      const woInfo = workOrders.find(w => w.numWO === comp.wo);
      
      if (woInfo && woInfo.linea === linea) {
        if (!stockPorComponente.has(comp.item_code)) {
          stockPorComponente.set(comp.item_code, comp.stock_global);
          // Log silenciado: console.log(`  📦 [${comp.item_code}] Stock inicial: ${comp.stock_global}`);
        }
      }
    });

    // 4. Procesar WOs en orden visual (de arriba a abajo)
    wosEnLinea.forEach((woNumero, indexEnLinea) => {
      const componentesDeWO = componentesUnicos.filter(c => c.wo === woNumero);
      
      // Log silenciado: if (componentesDeWO.length > 0) { console.log(...); }
      
      componentesDeWO.forEach(comp => {
        const stockActual = stockPorComponente.get(comp.item_code) || 0;
        const cantidadNecesaria = comp.req_quantity;
        
        // Calcular nuevo stock después del consumo
        const nuevoStock = stockActual - cantidadNecesaria;
        
        // Log silenciado: console.log(`    - ${comp.item_code}: stock ${stockActual} - necesita ${cantidadNecesaria} = ${nuevoStock}`);
        
        // Actualizar stock disponible en el mapa
        stockPorComponente.set(comp.item_code, nuevoStock);
        
        // Crear componente actualizado con el stock ANTES de consumir
        componentesActualizados.push({
          ...comp,
          disponible: stockActual // ← Stock DISPONIBLE antes de que esta WO consuma
        });
      });
    });
  });

  // 5. Componentes de WOs sin línea o NO_COMPONENTS (mantener originales)
  const componentesSinLinea = componentesUnicos.filter(comp => {
    const woInfo = workOrders.find(w => w.numWO === comp.wo);
    return !woInfo || comp.item_code === 'NO_COMPONENTS';
  });

  componentesActualizados.push(...componentesSinLinea);

  // Log silenciado: console.log('✅ [calcularConsumoSecuencial] COMPLETADO:', {...});

  // ✅ GUARDAR EN CACHÉ
  calculoCache.set(signature, {
    signature,
    result: componentesActualizados,
    timestamp: Date.now()
  });
  
  // Log silenciado: console.log('💾 [Cache] Resultado guardado. Tamaño caché:', calculoCache.size);

  return componentesActualizados;
};

/**
 * Transforma array de componentes en estructura matricial para ComponentsTable
 * 
 * @param componentes - Array de componentes desde la API (YA con consumo secuencial calculado)
 * @param filteredWOs - OPCIONAL: Array de NumWOs que están visibles actualmente
 * @returns Objeto con:
 *   - availableComponents: Array de item_codes únicos (columnas) SOLO de WOs visibles
 *   - componentAvailability: Map de WO -> item_code -> datos
 */
export const transformComponentesData = (
  componentes: IComponenteDisponibilidad[],
  filteredWOs?: string[] // ✅ Parámetro opcional
): {
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, { 
    disponible: number; 
    fecha_entrega: string | null; 
    formatted_value: string;
    req_quantity: number;
    stock_global: number;
  }>>;
} => {
  // Log silenciado: console.log('🔄 [ComponentesService] Transformando datos:', componentes.length, 'registros');
  
  // ✅ Filtrar componentes por WOs visibles (si se proporciona filtro)
  const componentesFiltrados = filteredWOs && filteredWOs.length > 0
    ? componentes.filter(comp => filteredWOs.includes(comp.wo))
    : componentes;
  
  // Log silenciado: console.log('🔍 [ComponentesService] Componentes después de filtro:', {...});
  
  // 1. Extraer todos los item_codes únicos (columnas) SOLO de componentes filtrados
  const itemCodesSet = new Set<string>();
  componentesFiltrados.forEach(comp => {
    // ✅ Excluir NO_COMPONENTS de las columnas
    if (comp.item_code !== 'NO_COMPONENTS') {
      itemCodesSet.add(comp.item_code);
    }
  });
  
  const availableComponents = Array.from(itemCodesSet).sort();
  
  // Log silenciado: console.log('📊 [ComponentesService] Item codes únicos (columnas):', {...});
  
  // 2. Construir estructura matricial: WO -> item_code -> datos
  const componentAvailability: Record<string, Record<string, {
    disponible: number;
    fecha_entrega: string | null;
    formatted_value: string;
    req_quantity: number;
    stock_global: number;
  }>> = {};
  
  // ✅ Usar componentes originales (no filtrados) para construir la matriz completa
  componentes.forEach(comp => {
    if (!componentAvailability[comp.wo]) {
      componentAvailability[comp.wo] = {};
    }
    
    componentAvailability[comp.wo][comp.item_code] = {
      disponible: comp.disponible,
      fecha_entrega: comp.fecha_entrega,
      formatted_value: comp.formatted_value,
      req_quantity: comp.req_quantity,
      stock_global: comp.stock_global
    };
  });
  
  // Log silenciado: console.log('✅ [ComponentesService] Transformación completada:', {...});
  
  return {
    availableComponents,
    componentAvailability
  };
};