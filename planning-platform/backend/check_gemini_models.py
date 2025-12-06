
import google.generativeai as genai
import os
from dotenv import load_dotenv

# .env 파일 로드 (환경변수 설정 확인용)
load_dotenv("planning-platform/backend/.env")

api_key = os.getenv("GOOGLE_GEMINI_API_KEY")

print(f"Checking models for API Key: {api_key[:5] if api_key else 'None'}...")

if not api_key or api_key == "dev-gemini-key":
    print("Default dev key detected or no key. Please ensure a valid API key is set in .env or environment.")
else:
    genai.configure(api_key=api_key)
    try:
        print("\nAvailable Models:")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- Name: {m.name}")
                print(f"  Display Name: {m.display_name}")
                print(f"  Supported Methods: {m.supported_generation_methods}")
                print("-" * 20)
    except Exception as e:
        print(f"Error listing models: {e}")
