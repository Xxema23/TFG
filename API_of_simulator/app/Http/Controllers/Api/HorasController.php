<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hora;
use Illuminate\Http\Request;

class HorasController extends Controller
{
    public function index()
    {
        return response()->json(Hora::all());
    }

    public function store(Request $request)
    {
        $horas = Hora::create($request->all());
        return response()->json($horas, 201);
    }

    public function show($id)
    {
        $horas = Hora::findOrFail($id);
        return response()->json($horas);
    }

    public function update(Request $request, $id)
    {
        $horas = Hora::findOrFail($id);
        $horas->update($request->all());
        return response()->json($horas);
    }

    public function destroy($id)
    {
        Hora::destroy($id);
        return response()->json(null, 204);
    }
}
