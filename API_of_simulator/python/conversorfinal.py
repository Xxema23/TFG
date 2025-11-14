import os
import warnings
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import re
import unicodedata
from io import StringIO

# Suprime warnings de openpyxl
warnings.filterwarnings(
    "ignore",
    message="Workbook contains no default style, apply openpyxl's default",
    module="openpyxl"
)

# --- Configuración de la conexión a PostgreSQL ---
DB_HOST = '10.122.18.111'
DB_PORT = '5432'
DB_NAME = 'carrier'
DB_USER = 'postgres'
DB_PASSWORD = 'carrier2025'

# --- Funciones de limpieza y normalización ---
def limpiar_valor(valor):
    if pd.isna(valor):
        return None
    texto = str(valor).strip()
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    return texto

def extraer_ultimo_numero(valor):
    if isinstance(valor, str) and ' of ' in valor:
        try:
            return float(valor.split()[-1])
        except:
            pass
    return valor

def normalizar_columna(columna):
    texto = str(columna)
    for orig, repl in zip(
        ['á','é','í','ó','ú','ü','ñ','Á','É','Í','Ó','Ú','Ü','Ñ'],
        ['a','e','i','o','u','u','n']*2
    ):
        texto = texto.replace(orig, repl)
    texto = texto.lower().strip().replace(' ', '_')
    return re.sub(r'[^\w_]', '', texto)

def procesar_e_insertar(config, conn):
    rutas = config.get('rutas') or [config['ruta']]
    hoja_cfg = config['hoja']
    fcampos, fdatos = config['fila_campos'] - 1, config['fila_datos'] - 1
    tabla = config['tabla']
    omitir = [normalizar_columna(c) for c in config['omit'].split(',') if c.strip()]

    dfs = []
    for carpeta in rutas:
        archivos = [f for f in os.listdir(carpeta) if f.lower().endswith(('.xlsx','.xls','.xlsm'))]
        if not archivos:
            raise FileNotFoundError(f"No hay archivos Excel en {carpeta}")
        archivos.sort(key=lambda x: os.path.getmtime(os.path.join(carpeta, x)), reverse=True)
        ruta_excel = os.path.join(carpeta, archivos[0])

        xls = pd.ExcelFile(ruta_excel)
        hoja = next((s for s in xls.sheet_names if s.lower() == hoja_cfg.lower()), None)
        if hoja is None:
            raise ValueError(f"Hoja '{hoja_cfg}' no encontrada en {ruta_excel}.")

        df = pd.read_excel(ruta_excel, sheet_name=hoja, header=fcampos,
                           skiprows=range(fcampos + 1, fdatos))
        df.dropna(how='all', inplace=True)
        df.columns = [normalizar_columna(c) for c in df.columns]
        df.drop(columns=[c for c in df.columns if c in omitir], errors='ignore', inplace=True)
        if tabla == 'ctb' and 'req_quantity' in df.columns:
            df['req_quantity'] = df['req_quantity'].apply(extraer_ultimo_numero)
        dfs.append(df)

    df_all = pd.concat(dfs, ignore_index=True)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s;",
            (tabla,)
        )
        columnas_db = {row[0] for row in cur.fetchall()}

    cols_orig = df_all.columns.tolist()
    cols_final = [c for c in cols_orig if c in columnas_db]
    df_all = df_all[cols_final]

    df_all = df_all.applymap(limpiar_valor)

    buffer = StringIO()
    df_all.to_csv(buffer, index=False, header=False, sep='\t', na_rep='\\N')
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.execute("SET session_replication_role='replica';")
        cur.execute(f"TRUNCATE TABLE {tabla} RESTART IDENTITY CASCADE;")
        cur.copy_from(buffer, tabla, sep='\t', columns=cols_final, null='\\N')
        cur.execute("SET session_replication_role='origin';")

    conn.commit()

# Ejecuta todas las importaciones
def ejecutar_todo():
    errores = []
    with psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER,
        password=DB_PASSWORD
    ) as conn:
        for cfg in IMPORTS:
            try:
                procesar_e_insertar(cfg, conn)
                print(f"✅ Tabla '{cfg['tabla']}' importada correctamente.")
            except Exception as e:
                errores.append(f"{cfg['tabla']}: {e}")
                print(f"❌ Error en tabla '{cfg['tabla']}': {e}")
    if errores:
        print("\nErrores encontrados:")
        for e in errores:
            print(f"- {e}")
    else:
        print("\n✅ Todas las tablas se importaron correctamente.")

# Configuración secuencial
IMPORTS = [
    {'ruta': r'excel/vacaciones',
     'hoja': 'Sheet1', 'fila_campos': 1, 'fila_datos': 2,
     'omit': '', 'tabla': 'dias_no_laborales'},
    {'ruta': r'excel/capacidad',
     'hoja': 'Sheet1', 'fila_campos': 1, 'fila_datos': 2,
     'omit': 'turnos', 'tabla': 'capacidad_turnos'},
    {'ruta': r'excel/vision_fabricacion',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'cliente,obj_fabricacion_sectores1,obj_fabricacion_sectores2,fprevini,fprevfin,fch_fin_prub',
     'tabla': 'vision_fabricacion'},
    {'ruta': r'excel/vision_fabricacion',
     'hoja': 'Horas', 'fila_campos': 5, 'fila_datos': 6,
     'omit': '', 'tabla': 'horas'},
    {'ruta': r'excel/vision_ventas',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'fch_embar_real', 'tabla': 'vision_ventas'},
    {'ruta': r'excel/palets',
     'hoja': 'Sheet1', 'fila_campos': 1, 'fila_datos': 2,
     'omit': 'tp_orden,est_ot,fch_entr_orden,fch_inic_fabricacion,fch_fin_fabricacion,tp_ord_rel,nº_ocov_rel,numero_linea,palet_maxqty,palet_realqty,palet_maxrow,palet_columnreal,ancho_paletequipo,profundidad_paletequipo,altura_paletequipo,peso_paletequipo,nº_corto_articulo,2º_nº_articulo,tp_ln,tipo_alm,cod_familia,palet_item_no',
     'tabla': 'palets'},
    {'rutas': [
         r'excel/CTB/CTB001',
         r'excel/CTB/CTB005'
     ],
     'hoja': 'Clear To Build Requirements', 'fila_campos': 1, 'fila_datos': 2,
     'omit': 'parent_order,supply_order_commit_date,supply_order_status_category',
     'tabla': 'ctb'},
    {'ruta': r'excel/stocks',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'planta,corto,tip_lin,tip_abast,familia,tip_prodct,num_serie,fch_creacion,num_wo,est_wo,ubic1,coste07',
     'tabla': 'stocks'},
    {'ruta': r'excel/vision_ventas',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'sucursal,num_documento,tipo_documento,ordenado_por,num_linea,incoterm,cod_prov,proveedor,clas_merc,costestand_07,fecha_orden,fecha_solic,pte_confirmacion,numreferencia,cod_familia,familia,cant_pendiente,coste_unitario,cant_surtida,cant_divisa,um_divisa,temporalidad',
     'tabla': 'vision_ventas'}
]

# Punto de entrada directo
if __name__ == "__main__":
    ejecutar_todo()
