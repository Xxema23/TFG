<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Palet extends Model
{
    // Nombre de la tabla
    protected $table = 'palets';

    // Clave primaria
    protected $primaryKey = 'num_orden';
    public $incrementing = false;
    protected $keyType = 'string';

    // Laravel no gestiona automáticamente los timestamps
    public $timestamps = false;

    // Atributos que se pueden asignar de forma masiva
    protected $fillable = [
        'num_orden',
        'num_de_palet',
        'palet_2nd_number',
    ];

    /**
     * Relación con el modelo VisionFabricacion.
     * Un palet pertenece a una orden de fabricación (wo).
     */
    public function visionFabricacion(): BelongsTo
    {
        return $this->belongsTo(VisionFabricacion::class, 'num_orden', 'wo');
    }
}
