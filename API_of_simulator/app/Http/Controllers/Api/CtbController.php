<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ctb;
use Illuminate\Http\Request;

class CtbController extends Controller
{
    // Obtener todos los registros sin paginación
public function index(Request $request)
{
    // Definir el número de registros por página
    $perPage = 3000; // Puedes ajustar este valor según lo que sea adecuado

    // Obtener los registros con paginación
    $ctbs = Ctb::paginate($perPage);

    // Retornar los resultados paginados como JSON
    return response()->json($ctbs);
}


    // Crear un nuevo registro
    public function store(Request $request)
    {
        // Crear el registro sin validaciones
        $ctb = Ctb::create($request->all());
        return response()->json($ctb, 201);
    }

    // Mostrar un registro por su ID
    public function show($id)
    {
        $ctb = Ctb::findOrFail($id);
        return response()->json($ctb);
    }

    // Actualizar un registro por su ID
    public function update(Request $request, $id)
    {
        $ctb = Ctb::findOrFail($id);
        $ctb->update($request->all());

        return response()->json($ctb);
    }

    // Eliminar un registro por su ID
    public function destroy($id)
    {
        Ctb::destroy($id);
        return response()->json(null, 204);
    }
}
