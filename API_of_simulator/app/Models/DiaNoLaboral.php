<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiaNoLaboral extends Model
{
    use HasFactory;

    // Definir la tabla a la que este modelo está asociado
    protected $table = 'dias_no_laborales';

    // Definir la clave primaria
    protected $primaryKey = 'id';

    // Si la clave primaria no es autoincremental, se debe indicar manualmente
    public $incrementing = true;

    // Definir los campos que son asignables en masa
    protected $fillable = ['vacaciones'];

    // Deshabilitar la gestión automática de timestamps
    public $timestamps = false;

    // Hacer que el campo 'id' sea visible en las respuestas JSON
    protected $visible = ['id', 'vacaciones'];
}
