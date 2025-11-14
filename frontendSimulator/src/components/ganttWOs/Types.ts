export interface WorkOrder {
  id: number;
  wo: string;
  line: string;
  hours: number;
  startDay: string;
  materialStatus: string;
  fchAcuse: string;
  fchObjetivo: string;
  sequence: number;
}

export interface Capacity {
  line: string;
  date: string;
  capacity: number;
}

// Alias para mantener compatibilidad con el código existente
export type DailyCapacity = Capacity;

export interface GanttData {
  workOrders: WorkOrder[];
  nonWorkingDays: string[];
  capacity: Capacity[];
}