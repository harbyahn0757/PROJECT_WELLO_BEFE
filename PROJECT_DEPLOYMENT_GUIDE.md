# PROJECT_WELLO_BEFE 전체 서비스 배포 운영 가이드

## 📋 프로젝트 개요

**프로젝트명**: PROJECT_WELLO_BEFE  
**서비스명**: WELLO 건강검진 플랫폼  
**배포일**: 2025년 9월 20일  
**서버 환경**: CentOS 7, Nginx, PM2, Python 3.9, Node.js 16.20

---

## 🏗️ 전체 서버 아키텍처

### **서버 구성도**
```
[인터넷] → [Nginx:80/443] → [내부 서비스들]
                 ├── / → Todayon_BE (Django:8000)
                 ├── /wello → WELLO FE (Static Files)
                 ├── /api/v1/wello → WELLO_BE (FastAPI:8082)
                 └── [기타 mediArc 서비스들]
```

### **포트 할당 현황**
| 서비스 | 포트 | 프로토콜 | PM2 프로세스명 | 상태 |
|--------|------|----------|----------------|------|
| Nginx | 80, 443 | HTTP/HTTPS | - | ✅ 운영중 |
| Todayon Marketing | 8000 | HTTP | Todayon_BE | ✅ 운영중 |
| WELLO Backend | 8082 | HTTP | WELLO_BE | 🆕 신규 |
| p9_mediArc | 기타 | HTTP | mediArc_* | ✅ 운영중 |

---

## 📁 전체 프로젝트 구조

### **워크스페이스 디렉토리 구조**
```
/home/workspace/
├── PROJECT_WELLO_BEFE/                    # 🆕 WELLO 프로젝트 루트
│   ├── planning-platform/                 # WELLO 메인 플랫폼
│   │   ├── backend/                       # WELLO Backend (FastAPI)
│   │   │   ├── app/
│   │   │   │   ├── main.py               # FastAPI 메인 앱
│   │   │   │   ├── api/v1/               # API 엔드포인트
│   │   │   │   ├── core/                 # 핵심 설정
│   │   │   │   ├── models/               # 데이터 모델
│   │   │   │   ├── services/             # 비즈니스 로직
│   │   │   │   └── utils/                # 유틸리티
│   │   │   ├── config.env                # 환경 설정
│   │   │   ├── requirements.txt          # Python 의존성
│   │   │   └── venv/                     # 가상환경
│   │   ├── frontend/                      # WELLO Frontend (React)
│   │   │   ├── src/
│   │   │   │   ├── components/           # React 컴포넌트
│   │   │   │   ├── pages/                # 페이지 컴포넌트
│   │   │   │   ├── services/             # API 서비스
│   │   │   │   ├── hooks/                # 커스텀 훅
│   │   │   │   └── styles/               # SCSS 스타일
│   │   │   ├── build/                    # 빌드 결과물 (배포용)
│   │   │   ├── package.json              # Node.js 의존성
│   │   │   └── craco.config.js           # 빌드 설정
│   │   └── docs/                          # 프로젝트 문서
│   ├── reference/                         # 참조 코드
│   ├── ecosystem.config.js                # PM2 설정
│   ├── nginx.conf                         # Nginx 설정 템플릿
│   └── deploy.sh                          # 배포 스크립트
├── Todayon_marketing_Jerry/               # ✅ 기존 투데이온 마케팅
│   ├── backend/                           # Django Backend
│   ├── frontend/                          # React Frontend  
│   └── logs/                              # 로그 파일들
├── p9_mediArc/                           # ✅ 기존 mediArc 시스템
│   ├── mcp/                              # MCP 서버
│   ├── channel-cs-service/               # 채널톡 CS
│   └── kraken-llm/                       # LLM 처리
└── BIZTALK_ATA/                          # ✅ 기존 알림톡 시스템
```

---

## 🌐 서비스 URL 구조

### **외부 접근 URL**
```
https://xogxog.com/                       # 기존 Todayon 서비스
https://xogxog.com/wello                  # 🆕 WELLO 건강검진 플랫폼
https://xogxog.com/api/v1/wello           # 🆕 WELLO Backend API
https://xogxog.com/management             # 기존 관리 시스템
https://xogxog.com/partnerboard           # 기존 파트너 보드
```

### **내부 서비스 URL**
```
http://127.0.0.1:8000                     # Todayon Django Backend
http://127.0.0.1:8082                     # 🆕 WELLO FastAPI Backend
```

---

## 🔧 기술 스택 상세

### **WELLO Backend (FastAPI)**
```python
# 주요 기술 스택
- Python 3.9+
- FastAPI 0.104.1
- uvicorn 0.24.0
- SQLAlchemy 1.4.53
- PostgreSQL (asyncpg)
- Redis (세션 관리)
- Pydantic (데이터 검증)

# 주요 기능
- 건강 데이터 처리 API
- Tilko 연동 서비스
- 병원 정보 서비스
- 환자 데이터 분석
- 검진 설계 서비스
```

### **WELLO Frontend (React)**
```javascript
// 주요 기술 스택
- React 19.1.1
- TypeScript 4.9.5
- React Router DOM 7.9.1
- Axios 1.12.2
- SASS 1.92.1
- CRACO 7.1.0

// 주요 기능
- 모바일 반응형 UI
- 건강 데이터 뷰어
- 동적 설문조사
- 인증 시스템
- 건강 습관 관리
```

---

## 🚀 배포 및 운영 계획

### **Phase 1: 백엔드 배포 (WELLO_BE)**

#### **1-1. 환경 설정**
```bash
# 가상환경 활성화 및 의존성 설치
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
source venv/bin/activate
pip install -r requirements.txt

# 환경 변수 설정
cp config.env.template config.env
vi config.env  # 실제 DB 정보 입력
```

#### **1-2. PM2 서비스 등록**
```bash
# ecosystem.config.js 적용
pm2 start ecosystem.config.js

# 서비스 확인
pm2 list
pm2 logs WELLO_BE
```

#### **1-3. 헬스체크**
```bash
# API 응답 확인
curl http://127.0.0.1:8082/docs
curl http://127.0.0.1:8082/api/v1/wello/health
```

### **Phase 2: 프론트엔드 배포 (WELLO FE)**

#### **2-1. 빌드 환경 설정**
```bash
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend

# 의존성 설치
npm install

# 환경 변수 설정
vi .env.production
```

#### **2-2. 프로덕션 빌드**
```bash
# 빌드 실행
npm run build

# 빌드 결과 확인
ls -la build/
du -sh build/
```

#### **2-3. 정적 파일 배포**
```bash
# Nginx 정적 파일 서빙 설정
# build/ 디렉토리가 Nginx에서 직접 서빙됨
```

### **Phase 3: Nginx 통합 설정**

#### **3-1. Nginx 설정 업데이트**
```nginx
# /etc/nginx/nginx.conf 수정
server {
    listen 80;
    server_name xogxog.com www.xogxog.com;
    
    # WELLO 프론트엔드 (React SPA)
    location /wello {
        alias /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend/build;
        try_files $uri $uri/ /wello/index.html;
        
        # 캐싱 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }
    
    # WELLO Backend API
    location /api/v1/wello {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # 기존 서비스들 유지
    location /api {
        proxy_pass http://127.0.0.1:8000;  # Todayon
    }
    
    location / {
        proxy_pass http://127.0.0.1:8000;  # Todayon
    }
}
```

#### **3-2. Nginx 설정 적용**
```bash
# 설정 문법 검사
nginx -t

# Nginx 재로드
systemctl reload nginx

# 서비스 상태 확인
systemctl status nginx
```

### **Phase 4: 통합 테스트 및 모니터링**

#### **4-1. 기능 테스트**
```bash
# WELLO 프론트엔드 접근 테스트
curl -I https://xogxog.com/wello

# WELLO API 테스트
curl https://xogxog.com/api/v1/wello/docs

# 기존 서비스 영향도 테스트
curl -I https://xogxog.com/
curl -I https://xogxog.com/management
```

#### **4-2. 성능 모니터링**
```bash
# PM2 모니터링
pm2 monit

# 시스템 리소스 확인
htop
free -h
df -h

# 로그 모니터링
pm2 logs WELLO_BE --lines 100
tail -f /var/log/nginx/access.log
```

---

## 🔄 운영 및 유지보수

### **일상 운영 작업**

#### **서비스 관리**
```bash
# PM2 서비스 제어
pm2 start WELLO_BE
pm2 stop WELLO_BE
pm2 restart WELLO_BE
pm2 reload WELLO_BE

# 로그 확인
pm2 logs WELLO_BE
pm2 flush  # 로그 초기화
```

#### **배포 업데이트**
```bash
# 백엔드 업데이트
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
git pull origin main
pm2 restart WELLO_BE

# 프론트엔드 업데이트
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/frontend
git pull origin main
npm run build
# Nginx가 자동으로 새 정적 파일 서빙
```

### **백업 및 복구**

#### **설정 파일 백업**
```bash
# Nginx 설정 백업
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# PM2 설정 백업
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.backup.$(date +%Y%m%d_%H%M%S)
```

#### **서비스 복구**
```bash
# PM2 프로세스 복구
pm2 resurrect

# Nginx 설정 복구
cp /etc/nginx/nginx.conf.backup.* /etc/nginx/nginx.conf
nginx -t && systemctl reload nginx
```

### **모니터링 및 알림**

#### **헬스체크 스크립트**
```bash
#!/bin/bash
# health_check.sh

# WELLO API 헬스체크
if ! curl -f http://127.0.0.1:8082/api/v1/wello/health > /dev/null 2>&1; then
    echo "WELLO_BE service is down!"
    pm2 restart WELLO_BE
fi

# 기존 서비스 헬스체크
if ! curl -f http://127.0.0.1:8000 > /dev/null 2>&1; then
    echo "Todayon_BE service is down!"
    pm2 restart Todayon_BE
fi
```

---

## 📊 예상 리소스 사용량

### **시스템 요구사항**
```
메모리 사용량:
- WELLO_BE (FastAPI): ~100-200MB
- WELLO_FE (Static): ~0MB (Nginx 서빙)
- 기존 서비스들: ~500MB
- 총 예상: ~700MB (여유 공간: 5GB+)

디스크 사용량:
- WELLO Backend: ~50MB
- WELLO Frontend (build): ~10MB
- 로그 파일들: ~100MB/월
- 총 예상: ~200MB

네트워크:
- WELLO API: 중간 트래픽
- 정적 파일: 캐싱으로 최적화
```

---

## 🚨 트러블슈팅 가이드

### **일반적인 문제들**

#### **WELLO_BE 서비스 시작 실패**
```bash
# 포트 충돌 확인
netstat -tlnp | grep 8082
lsof -i:8082

# 로그 확인
pm2 logs WELLO_BE

# 수동 실행으로 디버그
cd /home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8082
```

#### **프론트엔드 빌드 실패**
```bash
# Node.js 버전 확인
node --version  # 16.20.2 필요

# 메모리 부족 시
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build

# 캐시 초기화
rm -rf node_modules package-lock.json
npm install
```

#### **Nginx 설정 오류**
```bash
# 설정 문법 검사
nginx -t

# 설정 파일 복구
cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf

# 서비스 재시작
systemctl restart nginx
```

---

## 📞 지원 및 연락처

**개발팀**: Harby  
**배포일**: 2025년 9월 20일  
**문서 버전**: 1.0  
**마지막 업데이트**: 2025년 9월 20일

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2025-09-20 | 초기 배포 가이드 작성 | Harby |

---

**⚠️ 주의사항**: 이 문서는 프로덕션 환경 배포를 위한 공식 가이드입니다. 모든 변경사항은 백업 후 단계적으로 진행하시기 바랍니다.
