import React, { useState, useCallback, useRef } from 'react';
import api from '../../api';

type Tabla = 'vision_fabricacion' | 'ctb' | 'palets' | 'stocks';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABLAS: { key: Tabla; label: string; descripcion: string; columnas: string[] }[] = [
  {
    key: 'vision_fabricacion',
    label: 'Visión Fabricación',
    descripcion: 'Órdenes de trabajo',
    columnas: ['wo', 'linea', 'secuencia_fab', 'maquina', 'sig_code', 'estadowo', 'fch_objetivo', 'fch_pedido', 'fch_prometida', 'importe']
  },
  {
    key: 'ctb',
    label: 'CTB',
    descripcion: 'Componentes y disponibilidad',
    columnas: ['production_order', 'item_code', 'item_description', 'source', 'req_quantity', 'req_date', 'supply']
  },
  {
    key: 'stocks',
    label: 'Stocks',
    descripcion: 'Stock de artículos',
    columnas: ['articulo', 'descripcion', 'exist']
  },
  {
    key: 'palets',
    label: 'Palets',
    descripcion: 'Información de palets',
    columnas: ['num_orden', 'num_de_palet', 'palet_2nd_number']
  }
];

const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ isOpen, onClose }) => {
  const [tablaSeleccionada, setTablaSeleccionada] = useState<Tabla>('vision_fabricacion');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const tablaInfo = TABLAS.find(t => t.key === tablaSeleccionada)!;

  const handleArchivo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setArchivo(file);
    setEstado('idle');
    setMensaje('');
  }, []);

  const handleImportar = useCallback(async () => {
    if (!archivo) return;

    setEstado('cargando');
    setMensaje('');

    const formData = new FormData();
    formData.append('tabla', tablaSeleccionada);
    formData.append('archivo', archivo);

    try {
      const response = await api.post('/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setEstado('ok');
        setMensaje(response.data.message);
      } else {
        setEstado('error');
        setMensaje(response.data.message);
      }
    } catch (error: any) {
      setEstado('error');
      setMensaje(error?.response?.data?.message || 'Error al conectar con el servidor');
    }
  }, [archivo, tablaSeleccionada]);

  const handleCerrar = useCallback(() => {
    setArchivo(null);
    setEstado('idle');
    setMensaje('');
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4">

        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📥 Importar datos</h2>
            <p className="text-xs text-gray-500 mt-0.5">Importa un Excel a la base de datos</p>
          </div>
          <button onClick={handleCerrar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Selector de tabla */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tabla de destino</label>
            <div className="grid grid-cols-3 gap-2">
              {TABLAS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTablaSeleccionada(t.key); setArchivo(null); setEstado('idle'); setMensaje(''); if (inputRef.current) inputRef.current.value = ''; }}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    tablaSeleccionada === t.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-800">{t.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.descripcion}</div>
                </button>
              ))}
            </div>
          </div>


          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                archivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onClick={() => inputRef.current?.click()}
            >
              {archivo ? (
                <div>
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium text-green-700">{archivo.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{(archivo.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1 text-gray-400">📂</div>
                  <div className="text-sm text-gray-500">Haz click para seleccionar el archivo</div>
                  <div className="text-xs text-gray-400 mt-0.5">.xlsx o .xls</div>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleArchivo}
              className="hidden"
            />
          </div>

          {/* Resultado */}
          {estado !== 'idle' && (
            <div className={`rounded-lg p-3 text-sm ${
              estado === 'cargando' ? 'bg-blue-50 text-blue-700' :
              estado === 'ok' ? 'bg-green-50 text-green-700' :
              'bg-red-50 text-red-700'
            }`}>
              {estado === 'cargando' && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Procesando Excel...
                </div>
              )}
              {estado === 'ok' && (
                <div>
                  <div>✅ {mensaje}</div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-xs underline text-green-700 hover:text-green-900"
                  >
                    Recargar aplicación para ver los cambios
                  </button>
                </div>
              )}
              {estado === 'error' && <div>❌ {mensaje}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t">
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleImportar}
            disabled={!archivo || estado === 'cargando'}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {estado === 'cargando' ? 'Importando...' : 'Importar'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImportExcelModal;