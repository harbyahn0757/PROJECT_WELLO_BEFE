"""
건강검진 관리 시스템 테스트 서버
"""

from fastapi import FastAPI
import uvicorn

app = FastAPI(title="건강검진 관리 시스템 테스트")

@app.get("/")
async def root():
    return {
        "message": "건강검진 관리 시스템 API 서버 테스트",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "건강검진 관리 API"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8082)