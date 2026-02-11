# WELNO 백오피스 (독립 앱)

병원별 RAG 임베딩 및 상담 내역 관리를 위한 독립 React 앱입니다.

## 개발

```bash
npm install
npm start
```

개발 서버: http://localhost:9283

## 빌드

```bash
npm run build
```

산출물: `build/` (homepage: `/backoffice`)

## 배포

통합 배포 스크립트에서 자동으로 빌드 후 `planning-platform/backend/static/backoffice/`로 복사됩니다.

```bash
# 프로젝트 루트에서
bash ./scripts/deploy_improved.sh
```

배포 후 접속: `https://<도메인>/backoffice/`

## API

동일 백엔드 사용: `/api/v1/admin/embedding` 또는 (welno.kindhabit.com) `/welno-api/v1/admin/embedding`
