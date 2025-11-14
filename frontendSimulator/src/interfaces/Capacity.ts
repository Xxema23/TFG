// interfaces/Capacity.ts

export interface CapacityData {
  year: number;      // Año (2025)
  week: number;      // Semana (1-53)
  day?: number;      // Día del mes (1-31)
  line: string;      // Línea de producción (L1, L31, etc.)
  value: number;     // Valor de capacidad en horas (0-24)
}

export interface CapacityGridItem {
  line: string;
  week: number;
  day: number;
  value: number;
}

export interface WeeklyCapacity {
  year: number;
  week: number;
  lineCapacities: Record<string, Record<string, number>>;  // line -> day -> value
}