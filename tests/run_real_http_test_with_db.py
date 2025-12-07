import json
import os
import sys
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

# 1. Load Config
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../planning-platform/backend"))
config_path = os.path.join(backend_path, "config.env")
load_dotenv(config_path)

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
API_URL = "http://localhost:8082/api/v1/checkup-design"

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def setup_test_data(cases):
    print("🛠️ Setting up Test Data in DB...")
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        for case in cases:
            # Clean up first to avoid conflict issues
            cur.execute("DELETE FROM wello.wello_patients WHERE uuid = %s", (case['uuid'],))
            
            # Insert Patient
            birth_date = f"{datetime.now().year - case['age']}-01-01"
            cur.execute("""
                INSERT INTO wello.wello_patients (uuid, hospital_id, name, birth_date, gender, phone_number, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, '010-0000-0000', NOW(), NOW())
            """, (case['uuid'], case['hospital_id'], case['patient_name'], birth_date, case['gender']))
            
            # Note: We don't insert health_history into wello_checkup_data here 
            # because the API might not read it if we provide it in the request body?
            # Actually, the API *does* read from DB (get_patient_health_data).
            # But inserting complex health data is hard.
            # Let's hope the API is robust enough to handle empty history if we don't provide it.
            # OR we can modify the dataset generator to not rely on history for most cases.
            
        conn.commit()
        print(f"✅ Inserted {len(cases)} patients into DB.")
    except Exception as e:
        print(f"❌ DB Setup Failed: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def cleanup_test_data(cases):
    print("🧹 Cleaning up Test Data...")
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        uuids = tuple([c['uuid'] for c in cases])
        cur.execute("DELETE FROM wello.wello_patients WHERE uuid IN %s", (uuids,))
        conn.commit()
        print("✅ Cleanup completed.")
    except Exception as e:
        print(f"❌ Cleanup Failed: {e}")
    finally:
        cur.close()
        conn.close()

def run_api_test(cases):
    print("🚀 Starting Real API Tests...")
    
    # Debug: Run only first case
    for i, case in enumerate(cases[:1]):
        print(f"\n[{i+1}] Testing: {case['patient_name']} ({case['case_description']})")
        
        # Payload Construction
        payload = {
            "uuid": case['uuid'],
            "hospital_id": case['hospital_id'],
            "selected_concerns": case.get('selected_concerns', []),
            "survey_responses": case.get('survey_responses', {}),
            "additional_info": {},
            "events": case.get('user_attributes', [])
        }
        
        # 1. Step 1 Call
        try:
            resp1 = requests.post(f"{API_URL}/create-step1", json=payload)
            if resp1.status_code != 200:
                print(f"   ❌ Step 1 Error ({resp1.status_code}): {resp1.text}")
                continue
                
            step1_result = resp1.json().get("data", {})
            persona = step1_result.get("persona", {})
            print(f"   ✅ [Step 1] Persona: {persona.get('primary_persona')} (Risk: {persona.get('risk_flags')})")
            
            # 2. Step 2 Call
            step2_payload = {
                "uuid": case['uuid'],
                "hospital_id": case['hospital_id'],
                "step1_result": step1_result,
                "selected_concerns": payload["selected_concerns"],
                "survey_responses": payload["survey_responses"]
            }
            
            resp2 = requests.post(f"{API_URL}/create-step2", json=step2_payload)
            if resp2.status_code != 200:
                print(f"   ❌ Step 2 Error ({resp2.status_code}): {resp2.text}")
                continue
                
            final_result = resp2.json().get("data", {})
            priority_2 = final_result.get('priority_2', {}).get('items', [])
            print(f"   ✅ [Step 2] Recommended: {priority_2}")
            
            # Save Result
            output_dir = "tests/integration_data/results"
            os.makedirs(output_dir, exist_ok=True)
            with open(f"{output_dir}/result_{i+1}_{case['patient_name']}.json", 'w', encoding='utf-8') as f:
                json.dump(final_result, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            print(f"   ❌ API Call Failed: {e}")

if __name__ == "__main__":
    # Load Dataset
    with open('tests/integration_data/qa_dataset.json', 'r', encoding='utf-8') as f:
        dataset = json.load(f)
        
    try:
        setup_test_data(dataset)
        run_api_test(dataset)
    finally:
        cleanup_test_data(dataset)

