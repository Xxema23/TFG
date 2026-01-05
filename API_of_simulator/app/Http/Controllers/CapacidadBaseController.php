<?php

namespace App\Http\Controllers;

use App\Models\CapacidadBaseLinea;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class CapacidadBaseController extends Controller
{
    /**
     * GET /api/scenarios/{scenarioId}/capacidades-base
     */
    public function index(int $scenarioId): JsonResponse
    {
        try {
            $capacidades = CapacidadBaseLinea::where('id_escenario', $scenarioId)
                ->orderBy('linea')
                ->get()
                ->map(function ($cap) {
                    return [
                        'line' => $cap->linea,
                        'daily_capacity' => (float) $cap->capacidad_diaria
                    ];
                });

            return response()->json($capacidades, 200);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener capacidades base',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/scenarios/{scenarioId}/capacidades-base
     * Body: { "S21": 10, "L14": 8 }
     */
    public function update(Request $request, int $scenarioId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            '*' => 'required|numeric|min:0|max:1000'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $capacidades = $request->all();
            $updated = [];
            $created = [];

            foreach ($capacidades as $linea => $capacidad) {
                $capacidadBase = CapacidadBaseLinea::updateOrCreate(
                    [
                        'id_escenario' => $scenarioId,
                        'linea' => $linea
                    ],
                    [
                        'capacidad_diaria' => $capacidad
                    ]
                );

                if ($capacidadBase->wasRecentlyCreated) {
                    $created[] = $linea;
                } else {
                    $updated[] = $linea;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Capacidades base actualizadas correctamente',
                'updated' => $updated,
                'created' => $created
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al actualizar capacidades base',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}