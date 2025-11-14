// src/services/FabricacionConHoras.tsx - VERSIÓN FINAL CORREGIDA
import api from "../api";
import { IFabricacionConHoras } from "../interfaces/IFabricacionConHoras";

/**
 * Obtener todas las fabricaciones con horas
 */
export const getFabricacionesConHoras = async (limit: number = 1000): Promise<IFabricacionConHoras[]> => {
  try {
    const response = await api.get<IFabricacionConHoras[]>("/fabricaciones-con-horas", {
      params: { limit }
    });
    
    console.log(`✅ Cargadas ${response.data.length} fabricaciones desde la API`);
    return response.data;
  } catch (error: any) {
    console.error("❌ Error al obtener fabricaciones:", error);
    throw error;
  }
};

/**
 * ✅ FUNCIÓN AUXILIAR: Formatear fecha para API
 */
const formatDateForAPI = (dateString: string): string => {
  try {
    // Si ya viene con hora, mantenerla
    if (dateString.includes(' ')) {
      return dateString;
    }
    
    // Si es fecha ISO (YYYY-MM-DD), añadir hora
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return `${dateString} 00:00:00`;
    }
    
    // Intentar parsear la fecha
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Fecha inválida, usando original:', dateString);
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day} 00:00:00`;
  } catch (error) {
    console.error('❌ Error formateando fecha:', error);
    return dateString;
  }
};

/**
 * ✅ CORREGIDO: Aceptar datos en formato API (minúsculas) O formato TypeScript (mayúsculas)
 */
export const updateFabricacionConHoras = async (
  wo: string,
  data: Partial<IFabricacionConHoras> | Record<string, any>
): Promise<any> => {
  try {
    // ✅ NUEVO: Construir validData aceptando AMBOS formatos
    const validData: Record<string, any> = {};
    
    // ✅ FECHA: Aceptar tanto "Fch_Objetivo" como "fch_objetivo"
    const fechaObjetivo = (data as any).Fch_Objetivo || (data as any).fch_objetivo;
    if (fechaObjetivo !== undefined && fechaObjetivo !== null) {
      const fechaStr = String(fechaObjetivo).trim();
      if (fechaStr !== '' && fechaStr !== 'null' && fechaStr !== 'undefined') {
        validData.fch_objetivo = formatDateForAPI(fechaStr);
        console.log(`✅ Fecha validada para WO ${wo}:`, validData.fch_objetivo);
      }
    }
    
    // ✅ SECUENCIA: Aceptar tanto "Secuencia" como "secuencia_fab"
    const secuencia = (data as any).Secuencia || (data as any).secuencia_fab;
    if (secuencia !== undefined && secuencia !== null) {
      const secuenciaNum = Number(secuencia);
      if (!isNaN(secuenciaNum) && secuenciaNum > 0) {
        validData.secuencia_fab = Math.max(1, Math.floor(secuenciaNum));
        console.log(`✅ Secuencia validada para WO ${wo}:`, validData.secuencia_fab);
      }
    }
    
    // ✅ LÍNEA: Aceptar tanto "Linea" como "linea"
    const linea = (data as any).Linea || (data as any).linea;
    if (linea !== undefined && linea !== null) {
      const lineaStr = String(linea).trim();
      if (lineaStr !== '' && lineaStr !== 'null' && lineaStr !== 'undefined') {
        validData.linea = lineaStr;
        console.log(`✅ Línea validada para WO ${wo}:`, validData.linea);
      }
    }

    // ✅ CRÍTICO: Verificar que hay al menos UN campo válido
    if (Object.keys(validData).length === 0) {
      console.warn(`⚠️ WO ${wo}: No hay datos válidos para actualizar`, {
        dataRecibida: data,
        dataValidada: validData,
        tipoData: typeof data,
        keysRecibidas: Object.keys(data)
      });
      throw new Error('No hay datos válidos para actualizar');
    }

    console.log(`📤 Enviando actualización WO ${wo}:`, validData);

    const response = await api.put(`/fabricaciones-con-horas/${wo}`, validData);
    
    console.log(`✅ WO ${wo} actualizada correctamente`);
    return response.data;
    
  } catch (error: any) {
    const errorInfo = {
      wo,
      error: error.message || 'Error desconocido',
      dataSent: data,
      status: error.response?.status,
      serverMessage: error.response?.data?.message || error.response?.data
    };
    
    console.error(`❌ Error al actualizar WO ${wo}:`, errorInfo);
    
    const enhancedError: any = new Error(
      error.message || 
      error.response?.data?.message || 
      'Error al actualizar fabricación'
    );
    enhancedError.originalError = error;
    enhancedError.woId = wo;
    enhancedError.dataSent = data;
    
    throw enhancedError;
  }
};

/**
 * Actualizar múltiples fabricaciones en lote
 */
export const updateMultipleFabricaciones = async (
  updates: Array<{ wo: string; data: Partial<IFabricacionConHoras> }>
): Promise<{ success: number; failed: number; errors: any[] }> => {
  console.log(`📦 Iniciando actualización de ${updates.length} WOs en lote`);
  
  let successCount = 0;
  let failedCount = 0;
  const errors: any[] = [];

  const BATCH_SIZE = 10;
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updates.length / BATCH_SIZE);
    
    console.log(`📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} WOs)`);
    
    const results = await Promise.allSettled(
      batch.map(({ wo, data }) => updateFabricacionConHoras(wo, data))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failedCount++;
        const error = result.reason;
        errors.push({
          wo: batch[index].wo,
          error: error?.message || 'Error desconocido',
          details: error?.serverMessage || error?.originalError?.message
        });
      }
    });
    
    console.log(`✅ Lote ${batchNumber} completado: ${successCount}/${updates.length} éxitos hasta ahora`);
  }

  console.log(`✅ Actualización en lote FINALIZADA: ${successCount} éxitos, ${failedCount} fallos`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.warn('⚠️ Errores encontrados:', errors);
  } else if (errors.length > 10) {
    console.warn(`⚠️ ${errors.length} errores encontrados. Primeros 10:`, errors.slice(0, 10));
  }

  return { success: successCount, failed: failedCount, errors };
};