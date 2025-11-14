// src/utils/dateUtils.ts

/**
 * Calcula la fecha del lunes de una semana ISO 8601 específica.
 * ISO 8601: La semana 1 es la primera semana con al menos 4 días en el año nuevo.
 * El lunes es el primer día de la semana.
 * @param year El año.
 * @param week El número de semana (1-53).
 * @returns Objeto Date representando el Lunes de esa semana.
 */
function getMondayOfWeek(year: number, week: number): Date {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    const isoMonday = simple;
    // Retroceder al lunes si no lo es ya (0 es Domingo, así que necesita -6 días)
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    isoMonday.setUTCDate(simple.getUTCDate() + diff);
    return isoMonday;
  }
  
  /**
   * Obtiene un array de strings de fecha (YYYY-MM-DD) para una semana específica (Lunes a Domingo).
   * @param year El año.
   * @param week El número de semana ISO (1-53).
   * @returns Array de 7 strings de fecha (YYYY-MM-DD), de Lunes a Domingo.
   */
  export function getWeekDates(year: number, week: number): string[] {
    const monday = getMondayOfWeek(year, week);
    const weekDates: string[] = [];
  
    for (let i = 0; i < 7; i++) { // 0=Lunes, 1=Martes, ..., 6=Domingo
      const currentDate = new Date(monday);
      currentDate.setUTCDate(monday.getUTCDate() + i);
      // Formatear a YYYY-MM-DD en UTC para evitar problemas de zona horaria
      const yyyy = currentDate.getUTCFullYear();
      const mm = String(currentDate.getUTCMonth() + 1).padStart(2, '0'); // Meses son 0-11
      const dd = String(currentDate.getUTCDate()).padStart(2, '0');
      weekDates.push(`${yyyy}-${mm}-${dd}`);
    }
  
    return weekDates;
  }
  
  // Ejemplo de uso:
  // const dates = getWeekDates(2024, 1); // ['2024-01-01', '2024-01-02', ..., '2024-01-07']
  // const datesLastWeek = getWeekDates(2024, 52); // ['2024-12-23', ..., '2024-12-29']