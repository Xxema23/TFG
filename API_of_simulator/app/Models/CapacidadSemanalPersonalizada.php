<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CapacidadSemanalPersonalizada extends Model
{
    protected $table = 'capacidades_semanales_personalizadas';
    
    protected $fillable = [
        'id_escenario',
        'linea',
        'semana',
        'anio',
        'capacidad_diaria'
    ];

    protected $casts = [
        'capacidad_diaria' => 'decimal:2',
        'id_escenario' => 'integer',
        'semana' => 'integer',
        'anio' => 'integer'
    ];

    const CREATED_AT = 'fecha_creacion';
    const UPDATED_AT = 'fecha_actualizacion';
}