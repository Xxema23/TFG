// src/interfaces/ISimulatorData.ts
export interface IWorkOrderBackend {
  NumWO: string;
  Equipo: string;
  Secuencia: number;
  Linea: string;
  Estado_WO: string;
  Fch_Objetivo: string;
  Fch_Pedido: string | null;
  Fch_Prometida: string | null;
  Importe: number | null;
  Horas_totales_de_la_WO: string;
  sig_code?: string | null;
}

export interface IWorkOrderColor {
  wo: string;
  color: 'VERDE' | 'VERDE CLARO' | 'AMARILLO' | 'ROJO';
}

export interface IComponentAvailabilityBackend {
  wo: string;
  item_code: string;
  req_quantity: number;
  stock: number | null;
  fecha_prometida: string | null;
  cant_pedida: number | null;
  disponible: number;
  prioridad: number;
}

export interface IFilterDataBackend {
  NumWO: string;
  NumDoc: string;
  EquipoArticulo: string;
  EstadoWO: string;
  TipDoc: string;
  Articulo: string;
  Proveedor: string;
  FchObjetivo: string;
}

// ✅ NUEVA: Interfaz para Palets
export interface IPalet {
  id: number;
  num_orden: string;
  num_de_palet: string;
  palet_2nd_number: string | null;
}

// ✅ ACTUALIZADA: Interface para mapear datos del backend al frontend
export interface IWorkOrderFrontend {
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
  sigCode?: string | null;
  paletInfo?: {
    num_de_palet: string;
    palet_2nd_number?: string | null;
  } | null;
}