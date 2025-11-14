<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Hora extends Model
{
    // Nombre de la tabla
    protected $table = 'horas';

    // Clave primaria
    protected $primaryKey = 'id';

    // Indicamos que no se gestionan timestamps automáticamente
    public $timestamps = false;

    // Atributos que se pueden asignar masivamente
    protected $fillable = [
        'wo',
        'linea_por_centro',
        'horas',
    ];

    /**
     * Relación con VisionFabricacion (cada registro de horas pertenece a una orden de fabricación).
     */
    public function visionFabricacion(): BelongsTo
    {
        return $this->belongsTo(VisionFabricacion::class, 'wo', 'wo');
    }
}
