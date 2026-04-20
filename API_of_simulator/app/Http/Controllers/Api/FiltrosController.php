<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class FiltrosController extends Controller
{
    /**
     * Devuelve los datos filtrados según la consulta SQL.
     */
    public function index()
    {
        $resultados = DB::select("
            SELECT 
                vf.wo AS NumWO,
                vf.maquina AS EquipoArticulo,
                vf.estadowo AS EstadoWO,
                vf.sig_code AS SigCode,
                vf.fch_objetivo AS FchObjetivo
            FROM 
                vision_fabricacion vf
        ");

        return response()->json($resultados);
    }
}

