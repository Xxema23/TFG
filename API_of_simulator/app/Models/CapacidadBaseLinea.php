<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CapacidadBaseLinea extends Model
{
    protected $table = 'capacidades_base_linea';
    
    protected $fillable = [
        'id_escenario',
        'linea',
        'capacidad_diaria'
    ];

    protected $casts = [
        'capacidad_diaria' => 'decimal:2',
        'id_escenario' => 'integer'
    ];

    const CREATED_AT = 'fecha_creacion';
    const UPDATED_AT = 'fecha_actualizacion';
}