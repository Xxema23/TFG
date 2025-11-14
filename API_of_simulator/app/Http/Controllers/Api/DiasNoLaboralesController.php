<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiaNoLaboral;
use Illuminate\Http\Request;

class DiasNoLaboralesController extends Controller
{
    public function index()
    {
        return response()->json(DiaNoLaboral::all());
    }

    public function store(Request $request)
    {
        $diasNoLaborales = DiaNoLaboral::create($request->all());
        return response()->json($diasNoLaborales, 201);
    }

    public function show($id)
    {
        $diasNoLaborales = DiaNoLaboral::findOrFail($id);
        return response()->json($diasNoLaborales);
    }

    public function update(Request $request, $id)
    {
        $diasNoLaborales = DiaNoLaboral::findOrFail($id);
        $diasNoLaborales->update($request->all());
        return response()->json($diasNoLaborales);
    }

    public function destroy($id)
    {
        DiaNoLaboral::destroy($id);
        return response()->json(null, 204);
    }
}
