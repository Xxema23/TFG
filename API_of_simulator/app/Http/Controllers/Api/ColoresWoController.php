<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class ColoresWoController extends Controller
{
    /**
     * Devuelve los colores de WO según disponibilidad y fechas.
     */
    public function index(): JsonResponse
    {
        $query = "
            WITH datos AS (
                SELECT
                    vf.wo,
                    TO_DATE(vf.fch_objetivo, 'YYYY-MM-DD') AS fch_objetivo,
                    ctb.item_code,
                    ctb.req_quantity AS consumo,
                    COALESCE(s.exist, 0) AS stock,
                    TO_DATE(ec.fecha_prometida, 'YYYY-MM-DD') AS fch_entrega,
                    ec.cant_pedida AS cantidad
                FROM
                    vision_fabricacion vf
                JOIN ctb ON vf.wo = ctb.production_order
                LEFT JOIN stocks s ON ctb.item_code = s.articulo
                LEFT JOIN entrega_compra ec ON ctb.item_code = ec.cod_articulo
            ),
            disponibilidad AS (
                SELECT
                    d.*,
                    COALESCE(d.stock, 0) - d.consumo AS disponible_stock,
                    CASE
                        WHEN COALESCE(d.stock, 0) - d.consumo >= 0 THEN COALESCE(d.stock, 0) - d.consumo
                        WHEN d.fch_entrega IS NOT NULL THEN COALESCE(d.stock, 0) - d.consumo + d.cantidad
                        ELSE COALESCE(d.stock, 0) - d.consumo
                    END AS disponible
                FROM
                    datos d
            ),
            clasificacion AS (
                SELECT
                    wo,
                    MAX(CASE
                        WHEN disponible >= 0 THEN 1 -- VERDE
                        WHEN disponible < 0 AND fch_entrega IS NOT NULL AND (fch_objetivo - fch_entrega) >= 5 THEN 2 -- VERDE CLARO
                        WHEN disponible < 0 AND fch_entrega IS NOT NULL AND (fch_objetivo - fch_entrega) < 5 THEN 3 -- AMARILLO
                        ELSE 4 -- ROJO
                    END) AS prioridad
                FROM
                    disponibilidad
                GROUP BY
                    wo
            )
            SELECT
                c.wo,
                CASE c.prioridad
                    WHEN 1 THEN 'VERDE'
                    WHEN 2 THEN 'VERDE CLARO'
                    WHEN 3 THEN 'AMARILLO'
                    WHEN 4 THEN 'ROJO'
                END AS color
            FROM
                clasificacion c
            ORDER BY
                c.wo
        ";

        // Ejecutamos la consulta y devolvemos los resultados en JSON
        $result = DB::select($query);

        return response()->json($result);
    }
}
