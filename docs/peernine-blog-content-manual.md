# PeerNine Blog 컨텐츠 관리 매뉴얼

## 사이트 정보

| 항목 | 값 |
|------|-----|
| URL | https://blog.peernine.co.kr |
| 컨텐츠 경로 | `/var/www/blog.peernine.co.kr/` |
| 포스트 경로 | `/var/www/blog.peernine.co.kr/posts/` |
| 이미지 업로드 | `/var/www/blog.peernine.co.kr/uploads/` |
| 스타일시트 | `/var/www/blog.peernine.co.kr/assets/css/style.css` |
| 포스트 템플릿 | `/var/www/blog.peernine.co.kr/posts/_template.html` |

---

## 1. 서버 접속 (SFTP)

FTP 서버는 별도 설치되어 있지 않으며, **SFTP**(SSH 기반 파일 전송)를 사용합니다.
FTP보다 안전하고 별도 설치 없이 SSH만 있으면 바로 사용 가능합니다.

| 설정 | 값 |
|------|-----|
| 프로토콜 | **SFTP** (SSH File Transfer Protocol) |
| 호스트 | `223.130.142.105` |
| 포트 | `22` |
| 사용자 | SSH 계정과 동일 |
| 인증 | SSH 비밀번호 또는 키 파일 |
| 블로그 경로 | `/var/www/blog.peernine.co.kr/` |

### 방법 1: FileZilla (GUI, 추천)

1. FileZilla 다운로드: https://filezilla-project.org
2. 상단 빠른 연결:
   - 호스트: `sftp://223.130.142.105`
   - 사용자명: SSH 계정
   - 비밀번호: SSH 비밀번호
   - 포트: `22`
3. 연결 후 오른쪽(서버)에서 `/var/www/blog.peernine.co.kr/` 이동
4. 왼쪽(로컬)에서 파일 선택 → 오른쪽으로 드래그앤드롭

### 방법 2: 터미널 SFTP

```bash
sftp user@223.130.142.105

# 접속 후
cd /var/www/blog.peernine.co.kr/uploads/
put my-image.jpg

cd ../posts/
put 2026-02-16-my-post.html

exit
```

### 방법 3: SCP (단일 파일 전송)

```bash
# 파일 1개 업로드
scp my-image.jpg user@223.130.142.105:/var/www/blog.peernine.co.kr/uploads/

# 폴더 전체 업로드
scp -r ./images/ user@223.130.142.105:/var/www/blog.peernine.co.kr/uploads/
```

### 방법 4: VS Code Remote SSH

1. VS Code에서 `Remote - SSH` 확장 설치
2. `Ctrl+Shift+P` → "Remote-SSH: Connect to Host"
3. `user@223.130.142.105` 입력
4. 연결 후 "Open Folder" → `/var/www/blog.peernine.co.kr/`
5. 에디터에서 바로 파일 생성/편집/업로드 가능

### 업로드 후 권한 설정

파일 업로드 후 반드시 소유자를 nginx로 변경해야 웹에서 접근 가능합니다:

```bash
# SSH 접속 후 실행
chown -R nginx:nginx /var/www/blog.peernine.co.kr/
```

---

## 2. 블로그 포스트 작성하기

### Step 1: 템플릿 복사

```bash
cp /var/www/blog.peernine.co.kr/posts/_template.html \
   /var/www/blog.peernine.co.kr/posts/2026-02-16-my-first-post.html
```

**파일명 규칙:** `YYYY-MM-DD-제목-슬러그.html`
- 예: `2026-02-16-healthcare-ai-intro.html`
- 영문+숫자+하이픈만 사용 (한글 X)

### Step 2: 포스트 내용 수정

```bash
vi /var/www/blog.peernine.co.kr/posts/2026-02-16-my-first-post.html
```

수정할 부분:
1. `<title>` — 포스트 제목 (브라우저 탭에 표시)
2. `<meta name="description">` — 검색엔진용 요약 (150자 이내)
3. `<h1>` — 포스트 제목
4. `<p class="meta">` — 날짜, 작성자
5. `<div class="post-body">` — 본문 내용

### Step 3: 메인 페이지(index.html)에 링크 추가

```bash
vi /var/www/blog.peernine.co.kr/index.html
```

`<!-- === 포스트 항목: 최신순 위에 추가 === -->` 바로 아래에 추가:

```html
<li class="post-item">
    <div class="date">2026-02-16</div>
    <h2><a href="/posts/2026-02-16-my-first-post.html">포스트 제목</a></h2>
    <p class="excerpt">포스트 요약 내용 (2~3줄)</p>
    <div class="tags">
        <span class="tag">헬스케어</span>
        <span class="tag">AI</span>
    </div>
</li>
```

> "Coming Soon" 문구는 첫 포스트 추가 시 삭제하세요.

### Step 4: 권한 설정

```bash
chown nginx:nginx /var/www/blog.peernine.co.kr/posts/2026-02-16-my-first-post.html
```

완료! 별도 빌드나 nginx 리로드 필요 없이 즉시 반영됩니다.

---

## 3. 이미지 업로드

### 서버에 직접 업로드

```bash
# SCP로 로컬 → 서버
scp my-image.jpg user@서버:/var/www/blog.peernine.co.kr/uploads/

# 권한 설정
chown nginx:nginx /var/www/blog.peernine.co.kr/uploads/my-image.jpg
```

### 포스트에서 이미지 사용

```html
<img src="/uploads/my-image.jpg" alt="이미지 설명">
```

### 이미지 파일명 규칙
- 영문 소문자 + 숫자 + 하이픈: `healthcare-dashboard-01.jpg`
- 한글, 공백, 특수문자 X
- 권장 형식: JPG, PNG, WebP
- 권장 크기: 가로 1200px 이하 (자동 리사이즈 없음)

---

## 4. 디렉토리 구조

```
/var/www/blog.peernine.co.kr/
├── index.html                          ← 블로그 메인 (포스트 목록)
├── assets/
│   ├── css/
│   │   └── style.css                   ← 블로그 스타일시트
│   ├── js/                             ← JS 파일 (필요시)
│   └── images/                         ← 공통 이미지 (로고 등)
├── posts/
│   ├── _template.html                  ← 포스트 템플릿 (복사해서 사용)
│   ├── 2026-02-16-first-post.html      ← 포스트 파일
│   └── ...
└── uploads/                            ← 포스트용 이미지/파일
    ├── first-post-cover.jpg
    └── ...
```

---

## 5. 본문 작성 HTML 가이드

### 기본 텍스트

```html
<p>일반 텍스트 문단입니다.</p>
```

### 소제목 (h2, h3)

```html
<h2>큰 소제목</h2>
<h3>작은 소제목</h3>
```

### 이미지

```html
<img src="/uploads/파일명.jpg" alt="이미지 설명">
```

### 링크

```html
<a href="https://example.com">링크 텍스트</a>
```

### 강조

```html
<strong>굵은 텍스트</strong>
<em>기울임 텍스트</em>
```

### 인용문

```html
<blockquote>
    인용할 내용을 여기에 작성합니다.
</blockquote>
```

### 목록

```html
<!-- 순서 없는 목록 -->
<ul>
    <li>항목 1</li>
    <li>항목 2</li>
</ul>

<!-- 순서 있는 목록 -->
<ol>
    <li>첫 번째</li>
    <li>두 번째</li>
</ol>
```

### 코드

```html
<!-- 인라인 코드 -->
<code>변수명</code>

<!-- 코드 블록 -->
<pre><code>
function hello() {
    console.log("Hello!");
}
</code></pre>
```

---

## 6. 포스트 Quick Checklist

새 포스트를 올릴 때마다 확인:

- [ ] `posts/` 에 HTML 파일 생성 (템플릿 복사)
- [ ] `<title>` 태그 수정
- [ ] `<meta description>` 수정
- [ ] `<h1>` 제목 수정
- [ ] 날짜/작성자 수정
- [ ] 본문 작성
- [ ] 이미지 있으면 `uploads/`에 업로드
- [ ] `index.html`에 포스트 링크 추가
- [ ] `chown nginx:nginx` 권한 설정
- [ ] 브라우저에서 확인: `https://blog.peernine.co.kr/posts/파일명.html`

---

## 7. 스타일 커스터마이즈

스타일시트 위치: `/var/www/blog.peernine.co.kr/assets/css/style.css`

### 색상 변경 (CSS 변수)

```css
:root {
    --primary: #2563eb;      /* 메인 색상 (링크 등) */
    --text: #1e293b;          /* 본문 텍스트 */
    --text-light: #64748b;    /* 보조 텍스트 */
    --bg: #ffffff;            /* 배경색 */
    --bg-gray: #f8fafc;       /* 회색 배경 */
    --border: #e2e8f0;        /* 구분선 */
    --max-width: 800px;       /* 본문 최대 너비 */
}
```

### 로고/네비게이션 변경

`index.html` 과 각 포스트의 `<header>` 부분 수정:
```html
<a href="/" class="logo">PeerNine Blog</a>
<nav>
    <a href="/">Home</a>
    <a href="https://peernine.co.kr">PeerNine</a>
    <!-- 메뉴 추가 -->
    <a href="/posts/about.html">About</a>
</nav>
```

---

## 8. 자주 쓰는 명령어 요약

```bash
# 새 포스트 생성
cp /var/www/blog.peernine.co.kr/posts/_template.html \
   /var/www/blog.peernine.co.kr/posts/YYYY-MM-DD-slug.html

# 이미지 업로드
scp image.jpg user@server:/var/www/blog.peernine.co.kr/uploads/

# 권한 일괄 설정
chown -R nginx:nginx /var/www/blog.peernine.co.kr/

# 사이트 확인
curl -I https://blog.peernine.co.kr
curl -I https://blog.peernine.co.kr/posts/YYYY-MM-DD-slug.html

# nginx 에러 확인
tail -20 /var/log/nginx/blog-peernine-error.log
```

---

## 9. 참고: peernine.co.kr DNS 전파 후 추가 작업

`peernine.co.kr`이 이 서버(223.130.142.105)로 전파되면:

```bash
# 인증서에 peernine.co.kr 추가
sudo certbot certonly --webroot -w /var/www/html \
  --expand \
  -d blog.peernine.co.kr \
  -d www.peernine.co.kr \
  -d peernine.co.kr

# nginx 리로드
sudo nginx -t && sudo systemctl reload nginx
```

이후 `peernine.co.kr` 접속 시에도 자동으로 `blog.peernine.co.kr`로 리다이렉트됩니다.
