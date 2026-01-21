// src/utils/DateUtils.ts

/**
 * ✅ CENTRALIZACIÓN DE FUNCIONES DE FECHAS
 * 
 * Este archivo contiene funciones útiles de manejo de fechas.
 * Es OPCIONAL - no se usa en los archivos críticos por ahora.
 */

// ============================================
// 🔧 NORMALIZACIÓN Y FORMATEO
// ============================================

/**
 * Normaliza cualquier formato de fecha a YYYY-MM-DD
 */
export const normalizeDate = (date: string | Date): string => {
  if (!date) {
    console.warn('⚠️ normalizeDate: fecha vacía o undefined');
    return '';
  }

  if (typeof date === 'string') {
    // Caso 1: Ya está normalizada (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Caso 2: Tiene espacio (YYYY-MM-DD HH:MM:SS)
    if (date.includes(' ')) {
      return date.split(' ')[0];
    }
    
    // Caso 3: Tiene T (ISO format: YYYY-MM-DDTHH:MM:SS)
    if (date.includes('T')) {
      return date.split('T')[0];
    }
    
    // Caso 4: Intentar parsear como Date
    try {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        console.warn('⚠️ normalizeDate: fecha inválida, retornando original:', date);
        return date;
      }
      return parsed.toISOString().split('T')[0];
    } catch (error) {
      console.error('❌ normalizeDate: error parseando fecha:', error);
      return date;
    }
  }
  
  // Caso 5: Es un objeto Date
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      console.warn('⚠️ normalizeDate: Date inválido');
      return '';
    }
    return date.toISOString().split('T')[0];
  }

  console.warn('⚠️ normalizeDate: tipo de dato no reconocido:', typeof date);
  return String(date);
};

/**
 * Formatea fecha para enviar a la API Laravel (YYYY-MM-DD HH:MM:SS)
 */
export const formatDateForAPI = (date: string | Date): string => {
  const normalized = normalizeDate(date);
  
  if (!normalized) {
    return '';
  }
  
  return `${normalized} 00:00:00`;
};

/**
 * Compara dos fechas ignorando hora
 */
export const isSameDay = (date1: string | Date, date2: string | Date): boolean => {
  if (!date1 || !date2) {
    return false;
  }
  
  return normalizeDate(date1) === normalizeDate(date2);
};

// ============================================
// 📅 CÁLCULOS DE SEMANAS ISO 8601
// ============================================

/**
 * Calcula número de semana ISO 8601
 */
export const getWeekNumber = (date: Date | string): number => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const target = new Date(dateObj.valueOf());
  const dayNr = (dateObj.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

/**
 * Calcula la fecha del lunes de una semana ISO 8601 específica
 */
export function getMondayOfWeek(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const isoMonday = simple;
  
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  isoMonday.setUTCDate(simple.getUTCDate() + diff);
  
  return isoMonday;
}

/**
 * Obtiene un array de strings de fecha (YYYY-MM-DD) para una semana específica
 */
export function getWeekDates(year: number, week: number): string[] {
  const monday = getMondayOfWeek(year, week);
  const weekDates: string[] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(monday);
    currentDate.setUTCDate(monday.getUTCDate() + i);
    
    const yyyy = currentDate.getUTCFullYear();
    const mm = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getUTCDate()).padStart(2, '0');
    
    weekDates.push(`${yyyy}-${mm}-${dd}`);
  }

  return weekDates;
}

// ============================================
// 🏭 DÍAS LABORABLES
// ============================================

/**
 * Verifica si una fecha es día laborable (Lunes a Viernes)
 */
export const isWorkingDay = (date: string | Date): boolean => {
  const normalized = normalizeDate(date);
  if (!normalized) return false;
  
  const dateObj = new Date(normalized);
  const dayOfWeek = dateObj.getDay();
  
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

// ============================================
// 📊 UTILIDADES ADICIONALES
// ============================================

/**
 * Obtiene el año de una fecha
 */
export const getYear = (date: string | Date): number => {
  const normalized = normalizeDate(date);
  return new Date(normalized).getFullYear();
};

/**
 * Obtiene el mes de una fecha (1-12)
 */
export const getMonth = (date: string | Date): number => {
  const normalized = normalizeDate(date);
  return new Date(normalized).getMonth() + 1;
};

/**
 * Obtiene el día del mes de una fecha
 */
export const getDay = (date: string | Date): number => {
  const normalized = normalizeDate(date);
  return new Date(normalized).getDate();
};