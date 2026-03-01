# peernine.co.kr DNS 이전 계획 (카페24 → 가비아)

## 현재 상황
- 도메인 등록: **가비아**
- 네임서버: **카페24** (ns1.cafe24dns.co.kr / ns3.cafe24dns.co.kr)
- 문제: 카페24에서 루트 도메인(peernine.co.kr) A 레코드 직접 수정 불가

## 목표
가비아 자체 DNS로 네임서버 변경 → 모든 레코드 자유 관리

---

## 이전할 레코드 전체 목록

### A 레코드
| 호스트 | IP | 비고 |
|--------|-----|------|
| peernine.co.kr (루트) | 223.130.142.105 | **NEW** — 우리 서버 |
| www.peernine.co.kr | 223.130.142.105 | 우리 서버 |
| blog.peernine.co.kr | 223.130.142.105 | 우리 서버 |
| dev.peernine.co.kr | 223.130.142.105 | 우리 서버 |
| cha.peernine.co.kr | 182.162.73.134 | 기존 유지 |
| peerstat.peernine.co.kr | 182.162.73.134 | 기존 유지 |
| dapp.peernine.co.kr | 182.162.73.171 | 기존 유지 |
| ims.peernine.co.kr | 192.168.2.74 | 기존 유지 (내부망) |

### MX 레코드 (구글 메일)
| 호스트 | 우선순위 | 값 |
|--------|---------|-----|
| peernine.co.kr | 1 | ASPMX.L.GOOGLE.COM |
| peernine.co.kr | 5 | ALT1.ASPMX.L.GOOGLE.COM |
| peernine.co.kr | 6 | ALT2.ASPMX.L.GOOGLE.COM |
| peernine.co.kr | 10 | ALT3.ASPMX.L.GOOGLE.COM |
| peernine.co.kr | 11 | ALT4.ASPMX.L.GOOGLE.COM |
| peernine.co.kr | 12 | ASPMX2.GOOGLEMAIL.COM |

### TXT/SPF 레코드
| 호스트 | 값 |
|--------|-----|
| peernine.co.kr | v=spf1 include:_spf.google.com ~all |
| peernine.co.kr | v=spf1 include:mail.stibee.com ~all |
| peernine.co.kr | v=spf1 ip4:175.106.105.76 ~all |
| checkup.peernine.co.kr | v=spf1 ip4:175.106.105.76 ~all |

---

## 작업 순서

### 1단계: 가비아 DNS에 레코드 사전 등록
- 가비아 로그인 → DNS 관리
- 위 레코드 전부 입력 (네임서버 변경 전에 미리!)

### 2단계: 네임서버 변경
- 가비아 → 도메인 관리 → 네임서버 설정
- 기존: ns1.cafe24dns.co.kr / ns3.cafe24dns.co.kr
- 변경: 가비아 NS (가비아 DNS 관리 화면에서 안내하는 값)

### 3단계: 전파 대기 + 확인
- 보통 1~24시간 소요
- 확인 명령어:
```bash
dig peernine.co.kr A +short
dig peernine.co.kr MX +short
dig peernine.co.kr NS +short
```

### 4단계: SSL 인증서 추가
```bash
sudo certbot certonly --webroot -w /var/www/html \
  --expand \
  -d blog.peernine.co.kr \
  -d www.peernine.co.kr \
  -d dev.peernine.co.kr \
  -d peernine.co.kr

sudo nginx -t && sudo systemctl reload nginx
```

### 5단계: nginx 설정 업데이트
- peernine.conf에 peernine.co.kr HTTPS 서버 블록 추가 (→ blog 리다이렉트)

---

## 체크리스트
- [ ] 가비아 DNS에 A 레코드 전부 등록
- [ ] 가비아 DNS에 MX 레코드 등록
- [ ] 가비아 DNS에 TXT/SPF 레코드 등록
- [ ] 네임서버 변경
- [ ] DNS 전파 확인
- [ ] 메일 수발신 테스트
- [ ] 각 서브도메인 접속 테스트
- [ ] SSL 인증서 발급 (peernine.co.kr 추가)
- [ ] nginx 설정 최종 반영

## 롤백 방법
문제 발생 시 가비아에서 네임서버를 다시 카페24로 되돌리면 원복됩니다.
- ns1.cafe24dns.co.kr
- ns3.cafe24dns.co.kr
