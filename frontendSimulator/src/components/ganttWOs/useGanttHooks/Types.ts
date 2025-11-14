
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";


export interface GanttData {
  workOrders: IFabricacionConHoras[];
  nonWorkingDays: string[];
  capacity: Capacity[];
}

export interface Capacity {
  line: string;
  date: string;
  capacity: number;
}

export interface WorkOrderChange {
  NumWO: string;
  originalFch_Objetivo: string;
  originalSecuencia: number;
  newFch_Objetivo: string;
  newSecuencia: number;
  originalLinea?: string;
  newLinea?: string;
}

export interface DropInfo {
  day: string;
  line: string;
  draggedItems: string[];
  insertBeforeWO?: string;
}