# 🚀 Instalación de dependencias y configuración de Laravel

## 📦 Instalación de dependencias

1. **Instalar dependencias con Composer**:

   ```bash


   composer install


   ```
2. **Instalar dependencias de JavaScript con npm**:

   ```bash


   npm install


   ```
3. **Generar la clave de la aplicación**:

   ```bash


   php artisan key:generate


   ```
4. **Migrar la base de datos**:

   ```bash


   php artisan migrate


   ```

## 🛠️ Configuración del archivo `.env` para PostgreSQL

Actualiza las siguientes líneas en tu archivo `.env`:

```env


DB_CONNECTION=pgsql


DB_HOST=127.0.0.1


DB_PORT=5432


DB_DATABASE=nombre_de_la_base_de_datos


DB_USERNAME=nombre_de_usuario


DB_PASSWORD=contraseña
```
