export interface IComponenteDisponibilidad {
  wo: string;                    // Work Order
  item_code: string;             // Código del componente
  item_description: string;      // Descripción
  req_quantity: number;          // Cantidad que NECESITA la WO (NUEVO)
  stock_global: number;          // Stock inicial del almacén (NUEVO)
  disponible: number;            // Stock disponible ACTUAL (se recalcula en frontend)
  fecha_entrega: string;         // Fecha de entrega (YYYY-MM-DD)
  formatted_value: string;       // Valor formateado (STRING)
  color_wo: string;              // Color: 'VERDE', 'AMARILLO', 'ROJO'
}

export interface ComponenteDisponibilidadParams {
  wos?: string[];
  limit?: number;
}