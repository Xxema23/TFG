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
      console.log('🗑️ [Cache] Entrada expirada eliminada:', key.substring(0, 50) + '...');
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
    console.log('🔍 [ComponentesService] Llamando API con params:', params);
    
    // Usar POST para enviar array de WOs (más seguro que GET con query params)
    const response = await axios.post<IComponenteDisponibilidad[]>(
      `${API_BASE_URL}/api/colores-wo-disponible`,
      {
        wos: params.wos || [],
        limit: params.limit || 10
      }
    );
    
    console.log('✅ [ComponentesService] Datos recibidos:', {
      total: response.data.length,
      uniqueWOs: [...new Set(response.data.map(c => c.wo))].length,
      uniqueItems: [...new Set(response.data.map(c => c.item_code))].length,
      primeros5: response.data.slice(0, 5)
    });
    
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
    console.log('⚡ [calcularConsumoSecuencial] Usando CACHÉ:', {
      componentes: cached.result.length,
      edad: Math.round((Date.now() - cached.timestamp) / 1000) + 's',
      signaturePreview: signature.substring(0, 50) + '...'
    });
    return cached.result;
  }
  
  console.log('🔢 [calcularConsumoSecuencial] INICIO:', {
    totalComponentes: componentes.length,
    totalWOs: workOrders.length
  });

  // ✅ Eliminar duplicados por WO + item_code
  const componentesUnicos = componentes.filter((comp, index, self) => 
    index === self.findIndex((c) => 
      c.wo === comp.wo && c.item_code === comp.item_code
    )
  );

  console.log('🔍 [calcularConsumoSecuencial] Componentes únicos:', {
    originales: componentes.length,
    unicos: componentesUnicos.length,
    eliminados: componentes.length - componentesUnicos.length
  });

  // 1. Agrupar WOs por línea (manteniendo el orden)
  const wosByLinea = new Map<string, string[]>();
  
  workOrders.forEach(wo => {
    if (!wosByLinea.has(wo.linea)) {
      wosByLinea.set(wo.linea, []);
    }
    wosByLinea.get(wo.linea)!.push(wo.numWO);
  });

  console.log('📊 [calcularConsumoSecuencial] WOs por línea:', {
    lineas: Array.from(wosByLinea.keys()),
    distribucion: Array.from(wosByLinea.entries()).map(([linea, wos]) => ({
      linea,
      wos: wos.length
    }))
  });

  // 2. Para cada línea, calcular consumo secuencial
  const componentesActualizados: IComponenteDisponibilidad[] = [];

  wosByLinea.forEach((wosEnLinea, linea) => {
    console.log(`\n🏭 [Línea ${linea}] Procesando ${wosEnLinea.length} WOs...`);
    
    // Mapa de stock disponible por componente en esta línea
    // Inicialmente = stock_global
    const stockPorComponente = new Map<string, number>();
    
    // 3. Inicializar stock para todos los componentes de esta línea
    componentesUnicos.forEach(comp => {
      const woInfo = workOrders.find(w => w.numWO === comp.wo);
      
      if (woInfo && woInfo.linea === linea) {
        if (!stockPorComponente.has(comp.item_code)) {
          stockPorComponente.set(comp.item_code, comp.stock_global);
          console.log(`  📦 [${comp.item_code}] Stock inicial: ${comp.stock_global}`);
        }
      }
    });

    // 4. Procesar WOs en orden visual (de arriba a abajo)
    wosEnLinea.forEach((woNumero, indexEnLinea) => {
      const componentesDeWO = componentesUnicos.filter(c => c.wo === woNumero);
      
      if (componentesDeWO.length > 0) {
        console.log(`  🔧 [WO ${indexEnLinea + 1}/${wosEnLinea.length}] ${woNumero}: ${componentesDeWO.length} componentes`);
      }
      
      componentesDeWO.forEach(comp => {
        const stockActual = stockPorComponente.get(comp.item_code) || 0;
        const cantidadNecesaria = comp.req_quantity;
        
        // Calcular nuevo stock después del consumo
        const nuevoStock = stockActual - cantidadNecesaria;
        
        console.log(`    - ${comp.item_code}: stock ${stockActual} - necesita ${cantidadNecesaria} = ${nuevoStock}`);
        
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

  console.log('✅ [calcularConsumoSecuencial] COMPLETADO:', {
    totalActualizados: componentesActualizados.length,
    ejemplos: componentesActualizados.slice(0, 3).map(c => ({
      wo: c.wo,
      item: c.item_code,
      stockGlobal: c.stock_global,
      disponible: c.disponible,
      necesita: c.req_quantity
    }))
  });

  // ✅ GUARDAR EN CACHÉ
  calculoCache.set(signature, {
    signature,
    result: componentesActualizados,
    timestamp: Date.now()
  });
  
  console.log('💾 [Cache] Resultado guardado. Tamaño caché:', calculoCache.size);

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
  console.log('🔄 [ComponentesService] Transformando datos:', componentes.length, 'registros');
  
  // ✅ Filtrar componentes por WOs visibles (si se proporciona filtro)
  const componentesFiltrados = filteredWOs && filteredWOs.length > 0
    ? componentes.filter(comp => filteredWOs.includes(comp.wo))
    : componentes;
  
  console.log('🔍 [ComponentesService] Componentes después de filtro:', {
    originales: componentes.length,
    filtrados: componentesFiltrados.length,
    wosVisibles: filteredWOs?.length || 'todas'
  });
  
  // 1. Extraer todos los item_codes únicos (columnas) SOLO de componentes filtrados
  const itemCodesSet = new Set<string>();
  componentesFiltrados.forEach(comp => {
    // ✅ Excluir NO_COMPONENTS de las columnas
    if (comp.item_code !== 'NO_COMPONENTS') {
      itemCodesSet.add(comp.item_code);
    }
  });
  
  const availableComponents = Array.from(itemCodesSet).sort();
  
  console.log('📊 [ComponentesService] Item codes únicos (columnas):', {
    total: availableComponents.length,
    primeros10: availableComponents.slice(0, 10)
  });
  
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
  
  console.log('✅ [ComponentesService] Transformación completada:', {
    wos: Object.keys(componentAvailability).length,
    columnas: availableComponents.length,
    ejemploWO: Object.keys(componentAvailability)[0],
    componentesDeEjemplo: Object.keys(componentAvailability[Object.keys(componentAvailability)[0]] || {}).length
  });
  
  return {
    availableComponents,
    componentAvailability
  };
};