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

// ⬇️⬇️⬇️ ARREGLADO: 7 días atrás + 30 adelante ⬇️⬇️⬇️
export const generateInitialWorkingDays = (nonWorkingDates?: string[]): string[] => {
  const nonWorkingSet = new Set(nonWorkingDates || []);
  const today = new Date();
  const days: string[] = [];

  // 7 días atrás
  let previousDate = new Date(today);
  let addedDays = 0;
  while (addedDays < 7) {
    previousDate.setDate(previousDate.getDate() - 1);
    const dayOfWeek = previousDate.getDay();
    const dateStr = previousDate.toISOString().split("T")[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingSet.has(dateStr)) {
      days.unshift(dateStr);
      addedDays++;
    }
  }

  // 30 días adelante (CAMBIADO de +1 año)
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 30);

  let currentDate = new Date(today);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = currentDate.toISOString().split("T")[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingSet.has(dateStr)) {
      days.push(dateStr);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
};