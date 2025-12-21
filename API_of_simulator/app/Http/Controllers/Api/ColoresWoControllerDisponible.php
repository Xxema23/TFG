<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ColoresWoControllerDisponible extends Controller
{
    public function index(Request $request)
    {
        try {
            // Validar request
            $request->validate([
                'wos' => 'required|array',
                'wos.*' => 'required|string',
                'limit' => 'sometimes|integer|min:1|max:50' // ✅ Reducido a 50 para performance
            ]);

            $wos = $request->input('wos');
            $limitPerWO = $request->input('limit', 10);

            Log::info('📊 [ColoresWO] Request', [
                'wos_count' => count($wos),
                'limit_per_wo' => $limitPerWO
            ]);

            // ✅ Validar cantidad de WOs para evitar queries enormes
            if (count($wos) > 500) {
                Log::warning('⚠️ Demasiadas WOs solicitadas', ['count' => count($wos)]);
                return response()->json([
                    'error' => 'Demasiadas WOs solicitadas',
                    'message' => 'Máximo 500 WOs por petición'
                ], 400);
            }

            // PASO 1: Verificar WOs existentes
            $existingWOs = DB::table('vision_fabricacion')
                ->whereIn('wo', $wos)
                ->pluck('wo')
                ->toArray();

            if (empty($existingWOs)) {
                Log::info('⚠️ Ningún WO encontrado');
                return response()->json([]);
            }

            Log::info('✅ WOs válidos', ['count' => count($existingWOs)]);

            // ✅ PASO 2: Query OPTIMIZADA con Window Function y ORDER BY CRITICIDAD
            $placeholders = implode(',', array_fill(0, count($existingWOs), '?'));

            $query = "
                WITH ranked_components AS (
                    SELECT 
                        ctb.production_order AS wo,
                        ctb.item_code,
                        COALESCE(ctb.item_description, '') AS item_description,
                        COALESCE(ctb.req_quantity, 0)::integer AS req_quantity,
                        COALESCE(SUBSTRING(ctb.req_date FROM 1 FOR 10), '') AS fecha_entrega,
                        COALESCE(ctb.req_quantity, 0)::text AS formatted_value,
                        CASE 
                            WHEN ctb.supply = 'On Hand' THEN 'VERDE'
                            WHEN ctb.supply IS NULL THEN 'ROJO'
                            ELSE 'AMARILLO'
                        END AS color_wo,
                        COALESCE(stocks.exist::integer, 0) AS stock_global,
                        -- ✅ CRITICIDAD = stock - necesidad (negativo = MÁS CRÍTICO)
                        (COALESCE(stocks.exist::integer, 0) - COALESCE(ctb.req_quantity, 0)::integer) AS criticidad,
                        -- ✅ Ranking POR WO ordenado por criticidad
                        ROW_NUMBER() OVER (
                            PARTITION BY ctb.production_order 
                            ORDER BY 
                                (COALESCE(stocks.exist::integer, 0) - COALESCE(ctb.req_quantity, 0)::integer) ASC NULLS LAST, -- Más críticos primero
                                COALESCE(ctb.req_quantity, 0)::integer DESC, -- Si empate, mayor cantidad
                                ctb.item_code ASC -- Alfabético como último criterio
                        ) as rank_in_wo
                    FROM ctb
                    LEFT JOIN stocks ON stocks.articulo = ctb.item_code
                    WHERE ctb.production_order IN ($placeholders)
                        AND ctb.item_code IS NOT NULL
                        AND ctb.item_code != ''
                        AND TRIM(ctb.item_code) != '' -- ✅ Evitar blancos
                )
                SELECT 
                    wo,
                    item_code,
                    item_description,
                    req_quantity,
                    fecha_entrega,
                    formatted_value,
                    color_wo,
                    stock_global,
                    criticidad
                FROM ranked_components
                WHERE rank_in_wo <= ? -- ✅ TOP N por WO
                ORDER BY wo, rank_in_wo -- ✅ Ordenado para frontend
            ";

            $params = array_merge($existingWOs, [$limitPerWO]);
            $results = DB::select($query, $params);

            Log::info('✅ Componentes obtenidos', [
                'total_rows' => count($results),
                'limit_per_wo' => $limitPerWO
            ]);

            // PASO 3: Identificar WOs sin componentes
            $wosWithComponents = array_unique(array_column($results, 'wo'));
            $wosWithoutComponents = array_diff($existingWOs, $wosWithComponents);

            // PASO 4: Formatear resultados
            $finalResults = [];

            foreach ($results as $item) {
                $finalResults[] = [
                    'wo' => (string) $item->wo,
                    'item_code' => (string) $item->item_code,
                    'item_description' => (string) $item->item_description,
                    'req_quantity' => (int) $item->req_quantity,
                    'stock_global' => (int) $item->stock_global,
                    'disponible' => (int) $item->stock_global, // Frontend recalcula consumo secuencial
                    'fecha_entrega' => (string) $item->fecha_entrega,
                    'formatted_value' => (string) $item->formatted_value,
                    'color_wo' => (string) $item->color_wo
                ];
            }

            // Agregar marcador para WOs sin componentes
            foreach ($wosWithoutComponents as $wo) {
                $finalResults[] = [
                    'wo' => (string) $wo,
                    'item_code' => 'NO_COMPONENTS',
                    'item_description' => 'Sin componentes asignados',
                    'req_quantity' => 0,
                    'stock_global' => 0,
                    'disponible' => 0,
                    'fecha_entrega' => '',
                    'formatted_value' => '0',
                    'color_wo' => 'GRIS'
                ];
            }

            Log::info('✅ Respuesta final', [
                'total_components' => count($finalResults),
                'wos_with_data' => count($wosWithComponents),
                'wos_without_data' => count($wosWithoutComponents)
            ]);

            return response()->json($finalResults);

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('❌ Validación fallida', ['errors' => $e->errors()]);
            return response()->json([
                'error' => 'Datos inválidos',
                'details' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            Log::error('❌ Error en colores-wo-disponible', [
                'message' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'error' => 'Error al obtener disponibilidad',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }
}