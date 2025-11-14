export interface IFabricacionConHoras {
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
  horas_totales_de_la_wo: string;
}