import * as XLSX from 'xlsx';
import api from '../api';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';

export const generarExcel = async (
  fabricaciones: IFabricacionConHoras[],
  nombreArchivo: string = 'planificacion'
) => {
  if (fabricaciones.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  // Obtener componentes de todas las WOs
  const numWOs = fabricaciones.map(f => f.NumWO);
  let componentesMap: Record<string, { item_code: string; req_quantity: number }[]> = {};

  try {
    const response = await api.post('/colores-wo-disponible', {
      wos: numWOs,
      limit: 50
    });

    response.data.forEach((item: any) => {
      if (item.item_code === 'NO_COMPONENTS') return;
      if (!componentesMap[item.wo]) componentesMap[item.wo] = [];
      componentesMap[item.wo].push({
        item_code: item.item_code,
        req_quantity: item.req_quantity
      });
    });
  } catch (e) {
    console.warn('No se pudieron cargar componentes', e);
  }

  // Calcular máximo de componentes por WO
  const maxComponentes = Math.max(
    0,
    ...Object.values(componentesMap).map(c => c.length)
  );

  // Construir cabeceras
  const cabeceras = [
    'NumWO', 'Equipo', 'Secuencia', 'Línea', 'SigCode', 'EstadoWO', 'FchObjetivo'
  ];

  for (let i = 1; i <= maxComponentes; i++) {
    cabeceras.push(`Componente${i}`, `Cantidad${i}`);
  }

  // Construir filas
  const filas = fabricaciones.map(fab => {
    const fila: any[] = [
      fab.NumWO,
      fab.Equipo || '',
      fab.Secuencia,
      fab.Linea,
      fab.sig_code || '',
      fab.Estado_WO || '',
      fab.Fch_Objetivo || ''
    ];

    const comps = componentesMap[fab.NumWO] || [];
    for (let i = 0; i < maxComponentes; i++) {
      fila.push(comps[i]?.item_code || '');
      fila.push(comps[i]?.req_quantity ?? '');
    }

    return fila;
  });

  // Crear libro Excel
  const ws = XLSX.utils.aoa_to_sheet([cabeceras, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planificación');

  // Estilo cabeceras
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cell]) continue;
    ws[cell].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center' }
    };
  }

  // Descargar
  const lineas = [...new Set(fabricaciones.map(f => f.Linea))].join('_');
  const fecha = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${nombreArchivo}_${lineas}_${fecha}.xlsx`);
};