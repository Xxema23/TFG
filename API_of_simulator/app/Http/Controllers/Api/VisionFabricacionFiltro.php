<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;

class VisionFabricacionFiltro extends Controller
{
    public function getFabricacionesConHoras()
    {
        $fabricaciones = DB::table('vision_fabricacion as vf')
            ->leftJoin('horas as h', function($join) {
                $join->on('vf.wo', '=', 'h.wo')
                     ->on('vf.linea', '=', 'h.linea_por_centro');
            })
            ->select([
                'vf.wo as NumWO',
                'vf.linea as Linea',
                'vf.fch_objetivo as Fch_Objetivo',
                'vf.secuencia_fab as Secuencia',
                'vf.estadowo as EstadoWO',
                'vf.num_pedido',
                'vf.tip_ped',
                'vf.lin_ped',
                'vf.maquina',
                'vf.sig_code',
                'vf.fch_inicio',
                'vf.frealfab',
                DB::raw("COALESCE(h.horas, 1.0)::text as horas_totales_de_la_wo")
            ])
            ->where('vf.estadowo', '>=', 39)
            ->where('vf.estadowo', '<', 90)
            ->whereNotIn('vf.linea', [
                'INSPECCION', 'RECEPCION', 'EXPEDICIONES', 
                'VARIOS', 'ALMACEN', 'COMPRAS'
            ])
            ->whereRaw("vf.fch_objetivo::date >= CURRENT_DATE - INTERVAL '20 days'")
            ->whereRaw("vf.fch_objetivo::date <= CURRENT_DATE + INTERVAL '365 days'")
            ->orderBy('vf.fch_objetivo', 'asc')
            ->orderBy('vf.secuencia_fab', 'asc')
            ->limit(1000)
            ->get();

        return response()->json($fabricaciones);
    }

    public function updateFabricacion(Request $request, $wo)
    {
        try {
            $validatedData = $request->validate([
                'fch_objetivo' => 'sometimes|date_format:Y-m-d H:i:s',
                'secuencia_fab' => 'sometimes|integer|min:1',
                'linea' => 'sometimes|string|max:50',
            ]);

            if (empty($validatedData)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay datos para actualizar'
                ], 400);
            }

            $updated = DB::table('vision_fabricacion')
                ->where('wo', $wo)
                ->update($validatedData);

            if ($updated) {
                return response()->json([
                    'success' => true,
                    'message' => 'Fabricación actualizada correctamente',
                    'wo' => $wo
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'No se encontró la WO o no hubo cambios'
            ], 404);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateFabricacionesBatch(Request $request)
    {
        try {
            $updates = $request->validate([
                'updates' => 'required|array|min:1|max:100',
                'updates.*.wo' => 'required|string',
                'updates.*.fch_objetivo' => 'sometimes|date_format:Y-m-d H:i:s',
                'updates.*.secuencia_fab' => 'sometimes|integer|min:1',
                'updates.*.linea' => 'sometimes|string|max:50',
            ]);

            $results = [
                'success' => [],
                'failed' => [],
                'skipped' => []
            ];

            DB::beginTransaction();

            foreach ($updates['updates'] as $update) {
                try {
                    $wo = $update['wo'];
                    unset($update['wo']);

                    if (empty($update)) {
                        $results['skipped'][] = [
                            'wo' => $wo,
                            'reason' => 'No hay datos para actualizar'
                        ];
                        continue;
                    }

                    $affected = DB::table('vision_fabricacion')
                        ->where('wo', $wo)
                        ->update($update);

                    if ($affected > 0) {
                        $results['success'][] = $wo;
                    } else {
                        $results['failed'][] = [
                            'wo' => $wo,
                            'reason' => 'WO no encontrada o sin cambios'
                        ];
                    }

                } catch (\Exception $e) {
                    $results['failed'][] = [
                        'wo' => $update['wo'] ?? 'unknown',
                        'reason' => $e->getMessage()
                    ];
                }
            }

            DB::commit();

            $totalSuccess = count($results['success']);
            $totalFailed = count($results['failed']);
            $totalSkipped = count($results['skipped']);

            return response()->json([
                'success' => $totalFailed === 0,
                'message' => "Actualizadas: {$totalSuccess}, Fallidas: {$totalFailed}, Omitidas: {$totalSkipped}",
                'summary' => [
                    'successful' => $totalSuccess,
                    'failed' => $totalFailed,
                    'skipped' => $totalSkipped,
                    'total' => count($updates['updates'])
                ],
                'results' => $results
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'success' => false,
                'message' => 'Error en batch update: ' . $e->getMessage()
            ], 500);
        }
    }
}