import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";

export const formatDateForAPI = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      console.error('Fecha inválida:', dateString);
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day} 00:00:00`;
  } catch (error) {
    console.error('Error al formatear fecha:', error, dateString);
    return dateString;
  }
};

export const formatDataForAPI = (data: Partial<IFabricacionConHoras>) => {
  const apiData: any = {};
  
  if (data.Fch_Objetivo) {
    apiData.fch_objetivo = formatDateForAPI(data.Fch_Objetivo);
  }
  
  if (data.Secuencia !== undefined && data.Secuencia !== null) {
    const secuencia = Math.max(1, Number(data.Secuencia) || 1);
    apiData.secuencia_fab = secuencia;
  }
  
  if (data.Linea) {
    apiData.linea = data.Linea;
  }
  
  return Object.keys(apiData).reduce((acc, key) => {
    const value = apiData[key];
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
};

// ========================================
// ✅ FIX CRÍTICO: Empezar desde HOY-7 días
// ========================================
export const generateInitialWorkingDays = (nonWorkingDates?: string[]): string[] => {
  const nonWorkingSet = new Set(nonWorkingDates || []);
  
  // ✅ USAR FECHA LOCAL, NO UTC
  const today = new Date();
  
  // 🔥 CAMBIO CRÍTICO: Empezar desde HOY-7 días
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 7);
  
  const startYear = startDate.getFullYear();
  const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
  const startDay = String(startDate.getDate()).padStart(2, '0');
  const startDateStr = `${startYear}-${startMonth}-${startDay}`;
  
  const days: string[] = [];

  console.log('📅 [generateInitialWorkingDays] Fecha de inicio (HOY-7):', startDateStr);

  // 30 días adelante desde HOY (no desde startDate)
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 30);
  
  const endYear = endDate.getFullYear();
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endDateStr = `${endYear}-${endMonth}-${endDay}`;
  
  console.log('📅 [generateInitialWorkingDays] Fecha final (HOY+30):', endDateStr);

  let currentDate = new Date(startDate); // ⬅️ Ahora empieza desde HOY-7
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    
    // ✅ FORMATO LOCAL
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Solo lunes-viernes Y no festivos
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingSet.has(dateStr)) {
      days.push(dateStr);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('✅ [generateInitialWorkingDays] Generados:', {
    total: days.length,
    primeros3: days.slice(0, 3),
    ultimos3: days.slice(-3)
  });

  return days;
};