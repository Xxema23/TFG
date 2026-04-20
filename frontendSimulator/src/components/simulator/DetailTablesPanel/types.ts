// components/DetailTablesPanel/types.ts
import { IFabricacionConHoras } from '../../../interfaces/IFabricacionConHoras';

export interface WorkOrder {
  id: string;
  numWO: string;
  equipo: string;
  secuencia: string | number;
  linea: string;
  estadoWO: string;
  fchObjetivo: string;
  fchPedido: string | null;
  fchPrometida: string | null;
  sigCode?: string | null;
  importe: number;
  cshTotal: number;
  paletInfo?: {
    num_de_palet: string | null;
    palet_2nd_number?: string | null;
  } | null;
  cliente?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnitario?: number;
  originalIndex?: number;
  _originalData?: IFabricacionConHoras;
}

export interface ComponentAvailability {
  [componentId: string]: {
    [woId: string]: {
      value: string | number;
      stock?: number;
      pedido?: number;
      fchEntrega?: string;
      disponible?: number;
    };
  };
}

export interface DetailTablesPanelProps {
  workOrders?: WorkOrder[];
  availableComponents?: string[];
  componentAvailability?: ComponentAvailability;
  onReorderWO?: (reorderedWOIds: string[]) => void;
  selectedWorkOrderIds?: string[];
  availableWOs?: string[];
  filteredFabrications?: IFabricacionConHoras[];
  useFilteredData?: boolean;
  defaultLineFilter?: string | null;
  lastUpdated?: Date | null;
  ganttCapacity?: any;
  ganttWorkingDays?: any;
  onWorkOrderUpdated?: (woId: string, field: string, value: any) => void;
  paletsMap?: Map<string, any>;
}

export interface DragState {
  isDragging: boolean;
  draggedWO: string | null;
  draggedOverWO: string | null;
}

export interface TableSyncOptions {
  workOrders: WorkOrder[];
  selectedWorkOrderIds: string[];
  availableWOs: string[];
  localOrderedWOIds: string[];
  getOrderedWOIds: () => string[];
}