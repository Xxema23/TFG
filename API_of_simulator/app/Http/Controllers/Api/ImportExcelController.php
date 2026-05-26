<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ImportExcelController extends Controller
{
    public function import(Request $request)
    {
        try {
            $request->validate([
                'tabla' => 'required|in:vision_fabricacion,ctb,palets,stocks,horas',
                'archivo' => 'required|file|mimes:xlsx,xls'
            ]);

            $tabla = $request->input('tabla');
            $archivo = $request->file('archivo');

            // Crear carpeta temp si no existe
            $tempDir = storage_path('app' . DIRECTORY_SEPARATOR . 'temp');
            if (!file_exists($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // Guardar temporalmente
            $nombreArchivo = 'import_' . time() . '.xlsx';
            $rutaCompleta = $tempDir . DIRECTORY_SEPARATOR . $nombreArchivo;
            $archivo->move($tempDir, $nombreArchivo);

            // Ruta al script Python
            $scriptPath = base_path('python' . DIRECTORY_SEPARATOR . 'importar.py');

            // Ejecutar Python
            $comando = "python \"$scriptPath\" \"$tabla\" \"$rutaCompleta\" 2>&1";
            $output = shell_exec($comando);

            // Limpiar archivo temporal
            if (file_exists($rutaCompleta)) {
                unlink($rutaCompleta);
            }

            if (str_starts_with(trim($output), 'OK:')) {
                return response()->json([
                    'success' => true,
                    'message' => trim($output)
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => trim($output)
                ], 400);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }
}