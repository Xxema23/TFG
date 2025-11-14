<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class PaletFiltro extends Controller
{
    /**
     * Devuelve el número de palets agrupados por orden de trabajo (wo).
     */
    public function index()
    {
        $paletsPorWo = DB::table('palets')
            ->select('num_orden as wo', DB::raw('COUNT(*) as numero_de_palets'))
            ->groupBy('num_orden')
            ->orderByDesc('numero_de_palets')
            ->get();

        return response()->json($paletsPorWo);
    }
}
