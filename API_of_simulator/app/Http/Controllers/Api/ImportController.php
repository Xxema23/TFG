<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class ImportController extends Controller
{
    private static $importLock = false;
    private static $lastImportTime = null;

    public function testNetworkPaths()
    {
        $testPaths = [
            base_path('python/excel/vacaciones/DIAS NO LABORALES.xlsx'),
            base_path('python/excel/vision_fabricacion/visionf.xlsm'),
            base_path('python/excel/vision_ventas/i_Det-Fab-InformeDeAnálisisDeFabricación-VISIÓNVENTAS!1034333!.xlsm'),
            base_path('python/excel/stocks/i_Det-Financiero-DetalleDeExistenciasALas00!1034313!.00h.xlsm'),
            base_path('python/excel/entrega_compras/i_Det-Compras-RecepcionesPendientes!1034336!.xlsm'),
            base_path('python/excel/palets/Book1 - 2025-04-10T174327.833.xlsx'),
            base_path('python/excel/capacidad/CAPACIDAD.xlsx'),
            base_path('python/excel/CTB/CTB001/CTB001-11-abr-2025.xlsx'),
            base_path('python/excel/CTB/CTB005/CTB005-11-abr-2025.xlsx')
        ];

        $results = [];

        foreach ($testPaths as $path) {
            try {
                if (file_exists($path)) {
                    $results[] = [
                        'path' => $path,
                        'status' => 'accessible',
                        'type' => is_dir($path) ? 'directory' : 'file',
                        'size' => is_file($path) ? filesize($path) : null
                    ];
                } else {
                    $results[] = [
                        'path' => $path,
                        'status' => 'not_accessible',
                        'error' => 'Path does not exist'
                    ];
                }
            } catch (\Exception $e) {
                $results[] = [
                    'path' => $path,
                    'status' => 'error',
                    'error' => $e->getMessage()
                ];
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Network path test completed',
            'results' => $results,
            'accessible_count' => count(array_filter($results, fn($r) => $r['status'] === 'accessible')),
            'total_count' => count($results)
        ]);
    }

    public function runPythonScript()
    {
        $lockFile = storage_path('python_import.lock');
        $statusFile = storage_path('python_status.json');

        // Verificar si ya hay proceso en ejecución
        if (file_exists($lockFile)) {
            $lockTime = filemtime($lockFile);
            $minutesAgo = (time() - $lockTime) / 60;
            
            if ($minutesAgo < 60) {
                return response()->json([
                    'status' => 'already_running',
                    'message' => 'Ya hay un proceso en ejecución',
                    'started_ago_minutes' => round($minutesAgo, 1)
                ], 409);
            }
            
            // Lock antiguo, eliminarlo
            @unlink($lockFile);
        }

        Log::info('Iniciando script Python en segundo plano');

        try {
            // ✅ CORREGIDO: Quitar "API_of_simulator/" porque base_path() ya apunta ahí
            $scriptPath = base_path('python/conversor_local.py');

            if (!file_exists($scriptPath)) {
                Log::error('Script Python no encontrado: ' . $scriptPath);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Script Python no encontrado',
                    'path' => $scriptPath
                ], 404);
            }

            // Crear lock y estado inicial
            file_put_contents($lockFile, time());
            file_put_contents($statusFile, json_encode([
                'status' => 'running',
                'message' => 'Procesando archivos Excel...',
                'started_at' => time()
            ]));

            // Ejecutar en segundo plano
            $command = 'start /B python "' . $scriptPath . '" 2>&1';
            pclose(popen($command, 'r'));

            Log::info('Script Python iniciado correctamente');

            return response()->json([
                'status' => 'started',
                'message' => 'Proceso iniciado en segundo plano',
                'timestamp' => now()
            ]);

        } catch (\Exception $e) {
            @unlink($lockFile);
            Log::error('Error al iniciar script: ' . $e->getMessage());
            
            return response()->json([
                'status' => 'error',
                'message' => 'Error al iniciar: ' . $e->getMessage()
            ], 500);
        }
    }

    public function checkStatus()
    {
        $lockFile = storage_path('python_import.lock');
        $statusFile = storage_path('python_status.json');

        // Si no existe archivo de estado, no hay proceso
        if (!file_exists($statusFile)) {
            return response()->json([
                'status' => 'idle',
                'message' => 'Sin proceso en ejecución'
            ]);
        }

        $status = json_decode(file_get_contents($statusFile), true);

        // Si el lock no existe, el proceso terminó
        if (!file_exists($lockFile)) {
            return response()->json($status);
        }

        // Verificar si el proceso está colgado (>60 minutos)
        $lockTime = filemtime($lockFile);
        $minutesAgo = (time() - $lockTime) / 60;
        
        if ($minutesAgo > 60) {
            @unlink($lockFile);
            file_put_contents($statusFile, json_encode([
                'status' => 'error',
                'message' => 'Proceso expirado (más de 60 minutos)',
                'expired_at' => time()
            ]));
            
            return response()->json([
                'status' => 'error',
                'message' => 'Proceso expirado'
            ]);
        }

        // Proceso en ejecución
        return response()->json(array_merge($status, [
            'running_for_minutes' => round($minutesAgo, 1)
        ]));
    }

    public function markComplete()
    {
        $lockFile = storage_path('python_import.lock');
        $statusFile = storage_path('python_status.json');

        file_put_contents($statusFile, json_encode([
            'status' => 'completed',
            'message' => 'Importación completada exitosamente',
            'completed_at' => time()
        ]));

        @unlink($lockFile);

        return response()->json([
            'status' => 'success',
            'message' => 'Proceso marcado como completado'
        ]);
    }
}