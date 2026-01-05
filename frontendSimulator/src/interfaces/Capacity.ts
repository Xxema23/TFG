// Capacidad semanal (excepciones)
export interface CapacityData {
  line: string;
  week: number;
  year: number;
  value: number;
}

// Capacidad base por línea (nueva)
export interface BaseCapacity {
  line: string;
  daily_capacity: number;
}

// Para la lógica híbrida
export interface DailyCapacity {
  line: string;
  date: string;
  capacity: number;
}