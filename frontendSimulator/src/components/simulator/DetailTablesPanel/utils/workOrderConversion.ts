// utils/WorkOrderConversion.ts - Utilidades para conversión entre formatos de WorkOrder

// SOLUCIÓN TEMPORAL: Definir la interfaz localmente hasta encontrar el archivo original
interface IFabricacionConHoras {
  NumWO: string;
  Equipo: string;
  Secuencia: number;
  Linea: string;
  Fch_Objetivo: string;
  Fch_Pedido: string | null;
  Fch_Prometida: string | null;
  Estado_WO: string;
  Importe: number;
  horas_totales_de_la_wo: string;
  sig_code?: string | null;
}

// Interfaz para WorkOrder del simulador
interface SimulatorWorkOrder {
  id: string;
  numWO: string;
  equipo: string;
  secuencia: number;
  linea: string;
  estadoWO: string;
  fchObjetivo: string;
  fchPedido: string;
  fchPrometida: string;
  importe: number | null;
  cshTotal: number;
  sigCode?: string;
  articulo?: string;
  proveedor?: string;
}

/**
 * Convierte una WorkOrder del simulador al formato IFabricacionConHoras
 */
export const convertSimulatorToGantt = (simulatorWO: SimulatorWorkOrder): IFabricacionConHoras => {
  return {
    NumWO: simulatorWO.numWO,
    Equipo: simulatorWO.equipo,
    Secuencia: simulatorWO.secuencia,
    Linea: simulatorWO.linea,
    Fch_Objetivo: simulatorWO.fchObjetivo,
    Fch_Pedido: simulatorWO.fchPedido || '',
    Fch_Prometida: simulatorWO.fchPrometida || '',
    Estado_WO: simulatorWO.estadoWO,
    Importe: simulatorWO.importe || 0,
    horas_totales_de_la_wo: simulatorWO.cshTotal.toString(),
    sig_code: simulatorWO.sigCode || ''
  };
};

/**
 * Convierte una IFabricacionConHoras al formato del simulador
 */
export const convertGanttToSimulator = (ganttWO: IFabricacionConHoras): SimulatorWorkOrder => {
  return {
    id: ganttWO.NumWO,
    numWO: ganttWO.NumWO,
    equipo: ganttWO.Equipo,
    secuencia: ganttWO.Secuencia,
    linea: ganttWO.Linea,
    estadoWO: ganttWO.Estado_WO,
    fchObjetivo: ganttWO.Fch_Objetivo,
    fchPedido: ganttWO.Fch_Pedido || '',
    fchPrometida: ganttWO.Fch_Prometida || '',
    importe: ganttWO.Importe || 0,
    cshTotal: parseFloat(ganttWO.horas_totales_de_la_wo) || 0,
    sigCode: ganttWO.sig_code || '',
    articulo: '',
    proveedor: ''
  };
};

/**
 * Convierte un array de WorkOrders del simulador al formato Gantt
 */
export const convertSimulatorArrayToGantt = (simulatorWOs: SimulatorWorkOrder[]): IFabricacionConHoras[] => {
  return simulatorWOs.map(convertSimulatorToGantt);
};

/**
 * Convierte un array de IFabricacionConHoras al formato del simulador
 */
export const convertGanttArrayToSimulator = (ganttWOs: IFabricacionConHoras[]): SimulatorWorkOrder[] => {
  return ganttWOs.map(convertGanttToSimulator);
};

/**
 * Verifica si dos WorkOrders son equivalentes (para comparaciones)
 */
export const areWorkOrdersEquivalent = (
  simulatorWO: SimulatorWorkOrder,
  ganttWO: IFabricacionConHoras
): boolean => {
  return (
    simulatorWO.numWO === ganttWO.NumWO &&
    simulatorWO.linea === ganttWO.Linea &&
    simulatorWO.fchObjetivo === ganttWO.Fch_Objetivo &&
    simulatorWO.secuencia === ganttWO.Secuencia
  );
};

/**
 * Crea un mapa de WorkOrders por NumWO para búsquedas rápidas
 */
export const createWorkOrderMap = <T extends { NumWO?: string; numWO?: string }>(
  workOrders: T[]
): Map<string, T> => {
  const map = new Map<string, T>();
  
  workOrders.forEach(wo => {
    const key = wo.NumWO || wo.numWO;
    if (key) {
      map.set(key, wo);
    }
  });
  
  return map;
};

/**
 * Encuentra WorkOrders que no están sincronizadas entre simulador y Gantt
 */
export const findUnsyncedWorkOrders = (
  simulatorWOs: SimulatorWorkOrder[],
  ganttWOs: IFabricacionConHoras[]
): {
  onlyInSimulator: SimulatorWorkOrder[];
  onlyInGantt: IFabricacionConHoras[];
  different: Array<{
    simulator: SimulatorWorkOrder;
    gantt: IFabricacionConHoras;
    differences: string[];
  }>;
} => {
  const simulatorMap = createWorkOrderMap(simulatorWOs);
  const ganttMap = createWorkOrderMap(ganttWOs);
  
  const onlyInSimulator: SimulatorWorkOrder[] = [];
  const onlyInGantt: IFabricacionConHoras[] = [];
  const different: Array<{
    simulator: SimulatorWorkOrder;
    gantt: IFabricacionConHoras;
    differences: string[];
  }> = [];
  
  // Encontrar WOs solo en simulador
  simulatorWOs.forEach(simWO => {
    const ganttWO = ganttMap.get(simWO.numWO);
    if (!ganttWO) {
      onlyInSimulator.push(simWO);
    } else {
      // Verificar diferencias
      const differences: string[] = [];
      
      if (simWO.linea !== ganttWO.Linea) {
        differences.push(`Línea: ${simWO.linea} vs ${ganttWO.Linea}`);
      }
      
      if (simWO.fchObjetivo !== ganttWO.Fch_Objetivo) {
        differences.push(`Fecha: ${simWO.fchObjetivo} vs ${ganttWO.Fch_Objetivo}`);
      }
      
      if (simWO.secuencia !== ganttWO.Secuencia) {
        differences.push(`Secuencia: ${simWO.secuencia} vs ${ganttWO.Secuencia}`);
      }
      
      if (differences.length > 0) {
        different.push({
          simulator: simWO,
          gantt: ganttWO,
          differences
        });
      }
    }
  });
  
  // Encontrar WOs solo en Gantt
  ganttWOs.forEach(ganttWO => {
    const simWO = simulatorMap.get(ganttWO.NumWO);
    if (!simWO) {
      onlyInGantt.push(ganttWO);
    }
  });
  
  return {
    onlyInSimulator,
    onlyInGantt,
    different
  };
};

/**
 * Calcula estadísticas de sincronización entre simulador y Gantt
 */
export const calculateSyncStats = (
  simulatorWOs: SimulatorWorkOrder[],
  ganttWOs: IFabricacionConHoras[]
): {
  totalSimulator: number;
  totalGantt: number;
  synchronized: number;
  unsynchronized: number;
  syncPercentage: number;
  status: 'synced' | 'partial' | 'unsynced';
} => {
  const { onlyInSimulator, onlyInGantt, different } = findUnsyncedWorkOrders(simulatorWOs, ganttWOs);
  
  const totalSimulator = simulatorWOs.length;
  const totalGantt = ganttWOs.length;
  const unsynchronized = onlyInSimulator.length + onlyInGantt.length + different.length;
  const synchronized = Math.max(0, Math.min(totalSimulator, totalGantt) - unsynchronized);
  
  const syncPercentage = totalSimulator > 0 ? (synchronized / totalSimulator) * 100 : 0;
  
  let status: 'synced' | 'partial' | 'unsynced';
  if (syncPercentage >= 95) {
    status = 'synced';
  } else if (syncPercentage >= 50) {
    status = 'partial';
  } else {
    status = 'unsynced';
  }
  
  return {
    totalSimulator,
    totalGantt,
    synchronized,
    unsynchronized,
    syncPercentage,
    status
  };
};

// Exportar también los tipos para uso externo
export type { SimulatorWorkOrder };