// src/interfaces/ISimulatorData.ts
export interface IWorkOrderBackend {
  NumWO: string;
  Equipo: string;
  Secuencia: number;
  Linea: string;
  Numero_de_pedido: string | null;
  Tipo_de_pedido: string | null;
  Estado_WO: number;
  Fch_Objetivo: string;
  Fch_Acuse: string | null;
  Fch_Albaran: string | null;
  Importe: number | null;
  Horas_totales_de_la_WO: string;
  Source?: string;
  Item_Code?: string;
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
  numDoc: string;
  tipDoc: string;
  estadoWO: string;
  fchObjetivo: string;
  fchAcuse: string;
  fchAlbarAn: string;
  importe: number | null;
  cshTotal: number;
  // ✅ NUEVA: Información de palets
  paletInfo?: {
    num_de_palet: string;
    palet_2nd_number?: string | null;
  } | null;
}