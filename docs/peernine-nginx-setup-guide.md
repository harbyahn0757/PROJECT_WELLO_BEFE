# PeerNine 도메인 Nginx 설정 가이드

## 개요

| 도메인 | 용도 | 컨텐츠 경로 |
|--------|------|-------------|
| `peernine.co.kr` | 메인 사이트 | `/var/www/peernine.co.kr/` |
| `blog.peernine.co.kr` | 블로그 | `/var/www/blog.peernine.co.kr/` |

---

## 1. 사전 준비 (DNS)

도메인 DNS에 A 레코드를 추가해야 합니다. (이 서버 공인IP로)

```
peernine.co.kr        A    <서버 공인IP>
www.peernine.co.kr    A    <서버 공인IP>
blog.peernine.co.kr   A    <서버 공인IP>
```

**확인 방법:**
```bash
dig peernine.co.kr +short
dig blog.peernine.co.kr +short
```

---

## 2. SSL 인증서 발급 (Let's Encrypt)

DNS 전파 완료 후 실행합니다.

```bash
# 인증서 발급 (3개 도메인 한 번에)
sudo certbot certonly --webroot \
  -w /var/www/html \
  -d peernine.co.kr \
  -d www.peernine.co.kr \
  -d blog.peernine.co.kr
```

> **주의:** 인증서 발급 전에 nginx HTTP 서버블록이 80번 포트에서 동작 중이어야 합니다.
> ACME challenge 경로(`/.well-known/acme-challenge/`)가 `/var/www/html`을 가리키고 있어야 합니다.

**발급 확인:**
```bash
ls -la /etc/letsencrypt/live/peernine.co.kr/
# fullchain.pem, privkey.pem 존재 확인
```

---

## 3. Nginx 설정

설정 파일: `/etc/nginx/conf.d/peernine.conf`

이미 생성되어 있습니다. SSL 인증서 발급 후 적용:

```bash
# 설정 문법 검증
sudo nginx -t

# Nginx 리로드 (무중단)
sudo systemctl reload nginx
```

---

## 4. 컨텐츠 디렉토리 구조

### 메인 사이트 (`peernine.co.kr`)

```
/var/www/peernine.co.kr/
├── index.html              ← 메인 랜딩 페이지
├── assets/
│   ├── css/                ← 스타일시트
│   ├── js/                 ← 자바스크립트
│   └── images/             ← 이미지 리소스
└── uploads/                ← 업로드 컨텐츠 (첨부파일 등)
```

### 블로그 (`blog.peernine.co.kr`)

```
/var/www/blog.peernine.co.kr/
├── index.html              ← 블로그 메인 (목록 페이지)
├── posts/                  ← 블로그 포스트 HTML
│   ├── 2026-02-16-first-post.html
│   └── ...
├── assets/
│   ├── css/                ← 블로그 스타일시트
│   ├── js/                 ← 블로그 스크립트
│   └── images/             ← 공통 이미지
└── uploads/                ← 포스트용 업로드 이미지/파일
```

---

## 5. 컨텐츠 업로드/배포 방법

### 파일 직접 업로드 (SCP/SFTP)

```bash
# 로컬 → 서버 파일 전송
scp ./my-page.html user@server:/var/www/peernine.co.kr/
scp ./my-image.png user@server:/var/www/blog.peernine.co.kr/uploads/

# 디렉토리 전체 전송
scp -r ./blog-assets/ user@server:/var/www/blog.peernine.co.kr/assets/
```

### 서버에서 직접 편집

```bash
# 메인 사이트 수정
vi /var/www/peernine.co.kr/index.html

# 블로그 포스트 추가
vi /var/www/blog.peernine.co.kr/posts/2026-02-16-new-post.html
```

### 권한 주의

파일 업로드 후 소유자를 nginx로 맞춰야 합니다:

```bash
chown -R nginx:nginx /var/www/peernine.co.kr/
chown -R nginx:nginx /var/www/blog.peernine.co.kr/
```

---

## 6. 전체 적용 순서 (Step-by-Step)

```
1) DNS A 레코드 등록 (peernine.co.kr, www, blog)
         ↓
2) DNS 전파 대기 (보통 수 분 ~ 수 시간)
         ↓
3) HTTP-only로 nginx 활성화 (ACME용)
   → sudo nginx -t && sudo systemctl reload nginx
         ↓
4) SSL 인증서 발급
   → sudo certbot certonly --webroot -w /var/www/html \
       -d peernine.co.kr -d www.peernine.co.kr -d blog.peernine.co.kr
         ↓
5) nginx 설정 최종 적용
   → sudo nginx -t && sudo systemctl reload nginx
         ↓
6) 확인
   → curl -I https://peernine.co.kr
   → curl -I https://blog.peernine.co.kr
```

---

## 7. SSL 인증서 자동 갱신

Let's Encrypt 인증서는 90일 유효. 자동 갱신 cron 확인:

```bash
# 기존 cron 확인
sudo crontab -l | grep certbot

# 없으면 추가
sudo crontab -e
# 아래 추가:
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## 8. 문제 해결

### nginx 리로드 실패

```bash
# 설정 검증 (에러 위치 표시)
sudo nginx -t

# 에러 로그 확인
tail -20 /var/log/nginx/peernine-error.log
tail -20 /var/log/nginx/blog-peernine-error.log
```

### SSL 인증서 발급 실패

```bash
# DNS가 이 서버를 가리키는지 확인
dig peernine.co.kr +short

# 80번 포트 접근 확인 (외부에서)
curl -I http://peernine.co.kr/.well-known/acme-challenge/test

# certbot 로그
cat /var/log/letsencrypt/letsencrypt.log
```

### 403 Forbidden

```bash
# 파일 권한 확인
ls -la /var/www/peernine.co.kr/
# nginx:nginx 소유이어야 함

# SELinux 확인 (활성화된 경우)
getenforce
# Enforcing이면:
chcon -R -t httpd_sys_content_t /var/www/peernine.co.kr/
chcon -R -t httpd_sys_content_t /var/www/blog.peernine.co.kr/
```

---

## 9. Nginx 설정 파일 위치 요약

| 파일 | 역할 |
|------|------|
| `/etc/nginx/nginx.conf` | 메인 설정 (기존 도메인들) |
| `/etc/nginx/conf.d/peernine.conf` | peernine 도메인 설정 (NEW) |
| `/etc/nginx/conf.d/mediarc-api.conf` | MediArc API 설정 |

---

## 10. 참고: 기존 서버 포트 현황

| 포트 | 서비스 | 비고 |
|------|--------|------|
| 80 | nginx | HTTP → HTTPS 리다이렉트 |
| 443 | nginx | HTTPS 서빙 |
| 8000 | Django | P9 마케팅 |
| 8001 | Flask | MediArc |
| 8082 | FastAPI | WELNO Backend |
| 8088 | Superset | 대시보드 |

peernine 도메인은 정적 파일만 서빙하므로 별도 백엔드 서비스가 필요하지 않습니다.
나중에 CMS나 API가 필요하면 백엔드 프록시 블록을 추가하면 됩니다.
