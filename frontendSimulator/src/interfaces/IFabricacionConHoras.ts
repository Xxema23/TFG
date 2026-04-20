export interface IFabricacionConHoras {
  NumWO: string;
  Equipo: string;
  Secuencia: number;
  Linea: string;
  Estado_WO: string;
  Fch_Objetivo: string;
  Fch_Pedido: string | null;
  Fch_Prometida: string | null;
  Importe: number | null;
  horas_totales_de_la_wo: string;
  sig_code?: string | null;
}