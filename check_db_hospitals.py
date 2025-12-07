import os
import psycopg2
from dotenv import load_dotenv

# Load Config
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "planning-platform/backend"))
config_path = os.path.join(backend_path, "config.env")
load_dotenv(config_path)

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cur = conn.cursor()
    
    # Check Tables
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    tables = [t[0] for t in cur.fetchall()]
    print("Tables:", tables)
    
    # Check Specific Hospital
    hospital_id = 'KIM_HW_CLINIC'
    if 'wello_hospitals' in tables:
        cur.execute("SELECT * FROM wello_hospitals WHERE hospital_id = %s", (hospital_id,))
    elif 'hospitals' in tables:
        cur.execute("SELECT * FROM hospitals WHERE hospital_id = %s", (hospital_id,))
    else:
        # Check in schema wello
        cur.execute("SELECT * FROM wello.wello_hospitals WHERE hospital_id = %s", (hospital_id,))
        
    print(f"Hospital {hospital_id}:", cur.fetchone())
    
    # Check inserted patient
    cur.execute("SELECT * FROM wello.wello_patients LIMIT 1")
    print("Inserted Patient Sample:", cur.fetchone())
        
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")

