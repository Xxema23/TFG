import sys
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# --- Configuración BD ---
DB_HOST = '127.0.0.1'
DB_PORT = '5432'
DB_NAME = 'tfg'
DB_USER = 'postgres'
DB_PASSWORD = 'tfg1'

def conectar():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )

def importar_vision_fabricacion(df, cur):
    columnas = ['wo','linea','secuencia_fab','maquina','sig_code','estadowo','fch_objetivo','fch_pedido','fch_prometida','importe']
    df = df[columnas].where(pd.notnull(df[columnas]), None)
    valores = [tuple(row) for row in df.itertuples(index=False)]
    sql = """
        INSERT INTO vision_fabricacion (wo, linea, secuencia_fab, maquina, sig_code, estadowo, fch_objetivo, fch_pedido, fch_prometida, importe)
        VALUES %s
        ON CONFLICT (wo) DO NOTHING
    """
    execute_values(cur, sql, valores)
    return cur.rowcount

def importar_ctb(df, cur):
    columnas = ['production_order','item_code','item_description','source','req_quantity','req_date','supply']
    df = df[columnas].where(pd.notnull(df[columnas]), None)
    valores = [tuple(row) for row in df.itertuples(index=False)]
    sql = """
        INSERT INTO ctb (production_order, item_code, item_description, source, req_quantity, req_date, supply)
        VALUES %s
        ON CONFLICT (production_order, item_code) DO UPDATE SET
            item_description = EXCLUDED.item_description,
            source = EXCLUDED.source,
            req_quantity = EXCLUDED.req_quantity,
            req_date = EXCLUDED.req_date,
            supply = EXCLUDED.supply
    """
    execute_values(cur, sql, valores)
    return cur.rowcount

def importar_stocks(df, cur):
    columnas = ['articulo', 'descripcion', 'exist']
    df = df[columnas].where(pd.notnull(df[columnas]), None)
    valores = [tuple(row) for row in df.itertuples(index=False)]
    sql = """
        INSERT INTO stocks (articulo, descripcion, exist)
        VALUES %s
        ON CONFLICT (articulo) DO UPDATE SET
            descripcion = EXCLUDED.descripcion,
            exist = stocks.exist + EXCLUDED.exist
    """
    execute_values(cur, sql, valores)
    return cur.rowcount    

def importar_palets(df, cur):
    columnas = ['num_orden','num_de_palet','palet_2nd_number']
    df = df[columnas].where(pd.notnull(df[columnas]), None)
    valores = [tuple(row) for row in df.itertuples(index=False)]
    sql = """
        INSERT INTO palets (num_orden, num_de_palet, palet_2nd_number)
        VALUES %s
        ON CONFLICT (num_orden) DO UPDATE SET
            num_de_palet = EXCLUDED.num_de_palet,
            palet_2nd_number = EXCLUDED.palet_2nd_number
    """
    execute_values(cur, sql, valores)
    return cur.rowcount

def main():
    if len(sys.argv) < 3:
        print("ERROR: Uso: python importar.py <tabla> <ruta_excel>")
        sys.exit(1)

    tabla = sys.argv[1]
    ruta_excel = sys.argv[2]

    try:
        df = pd.read_excel(ruta_excel)
        df.columns = [c.strip().lower() for c in df.columns]
    except Exception as e:
        print(f"ERROR: No se pudo leer el Excel: {e}")
        sys.exit(1)

    try:
        conn = conectar()
        cur = conn.cursor()

        if tabla == 'vision_fabricacion':
            n = importar_vision_fabricacion(df, cur)
        elif tabla == 'ctb':
            n = importar_ctb(df, cur)
        elif tabla == 'stocks':
            n = importar_stocks(df, cur)
        elif tabla == 'palets':
            n = importar_palets(df, cur)
        else:
            print(f"ERROR: Tabla desconocida: {tabla}")
            sys.exit(1)

        conn.commit()
        cur.close()
        conn.close()
        print(f"OK: {n} filas importadas en {tabla}")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()