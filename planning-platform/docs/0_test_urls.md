# WELLO 테스트 URL 모음

## 개발 모드 (localhost)

### 1. 안광수
```
http://127.0.0.1:9283/wello?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=KHW001
```
- **이름**: 안광수
- **성별**: 남성 (M)
- **건강검진**: 1건 (2021년)
- **처방전**: 9건
- **비밀번호**: 있음

### 2. 김영상
```
http://127.0.0.1:9283/wello?uuid=3a96200c-c61a-47b1-8539-27b73ef2f483&hospital=KHW001
```
- **이름**: 김영상
- **성별**: 남성 (M)
- **건강검진**: 4건 (2016, 2019, 2023, 2025년)
- **처방전**: 115건
- **비밀번호**: 있음

### 3. 김태연
```
http://127.0.0.1:9283/wello?uuid=de6a7823-e45d-4a44-aea6-3d74bb8aa44c&hospital=KHW001
```
- **이름**: 김태연
- **성별**: 여성 (F)
- **건강검진**: 2건 (2021년)
- **처방전**: 152건
- **비밀번호**: 있음

### 4. 이준희
```
http://127.0.0.1:9283/wello?uuid=f1965784-b8fa-4c53-950d-ccdeffece2a4&hospital=KHW001
```
- **이름**: 이준희
- **성별**: 남성 (M)
- **건강검진**: 3건 (2016, 2018, 2020년)
- **처방전**: 0건
- **비밀번호**: 없음

### 5. 손충기
```
http://127.0.0.1:9283/wello?uuid=5838c130-f23c-4a2b-b8bc-7bbbef8fd7cf&hospital=KHW001
```
- **이름**: 손충기
- **성별**: 남성 (M)
- **건강검진**: 1건 (2024년)
- **처방전**: 20건
- **비밀번호**: 없음

### 6. 성정옥 (신규)
```
http://127.0.0.1:9283/wello?uuid=3c16602b-ec67-423d-8609-90af3ddfe52e&hospital=KHW001
```
- **이름**: 성정옥
- **성별**: 여성 (F)
- **생년월일**: 1962-04-20
- **전화번호**: 010-1234-5678 (임시)
- **건강검진**: 없음 (신규 계정)
- **처방전**: 없음 (신규 계정)
- **비밀번호**: 없음

---

## 프로덕션 모드 (xogxog.com)

### 1. 안광수
```
https://xogxog.com/wello?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=KHW001
```

### 2. 김영상
```
https://xogxog.com/wello?uuid=3a96200c-c61a-47b1-8539-27b73ef2f483&hospital=KHW001
```

### 3. 김태연
```
https://xogxog.com/wello?uuid=de6a7823-e45d-4a44-aea6-3d74bb8aa44c&hospital=KHW001
```

### 4. 이준희
```
https://xogxog.com/wello?uuid=f1965784-b8fa-4c53-950d-ccdeffece2a4&hospital=KHW001
```

### 5. 손충기
```
https://xogxog.com/wello?uuid=5838c130-f23c-4a2b-b8bc-7bbbef8fd7cf&hospital=KHW001
```

### 6. 성정옥 (신규)
```
https://xogxog.com/wello?uuid=3c16602b-ec67-423d-8609-90af3ddfe52e&hospital=KHW001
```

---

## 브라우저 즐겨찾기용 HTML 파일

아래 HTML 파일을 브라우저에서 열어서 즐겨찾기를 한 번에 추가할 수 있습니다.

```html
<!DOCTYPE html>
<html>
<head>
    <title>WELLO 테스트 URL 즐겨찾기</title>
</head>
<body>
    <h1>WELLO 테스트 URL 즐겨찾기</h1>
    <p>아래 링크를 우클릭하여 즐겨찾기에 추가하세요.</p>
    
    <h2>개발 모드</h2>
    <ul>
        <li><a href="http://127.0.0.1:9283/wello?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=KHW001">안광수</a></li>
        <li><a href="http://127.0.0.1:9283/wello?uuid=3a96200c-c61a-47b1-8539-27b73ef2f483&hospital=KHW001">김영상</a></li>
        <li><a href="http://127.0.0.1:9283/wello?uuid=de6a7823-e45d-4a44-aea6-3d74bb8aa44c&hospital=KHW001">김태연</a></li>
        <li><a href="http://127.0.0.1:9283/wello?uuid=f1965784-b8fa-4c53-950d-ccdeffece2a4&hospital=KHW001">이준희</a></li>
        <li><a href="http://127.0.0.1:9283/wello?uuid=5838c130-f23c-4a2b-b8bc-7bbbef8fd7cf&hospital=KHW001">손충기</a></li>
        <li><a href="http://127.0.0.1:9283/wello?uuid=3c16602b-ec67-423d-8609-90af3ddfe52e&hospital=KHW001">성정옥 (신규)</a></li>
    </ul>
    
    <h2>프로덕션 모드</h2>
    <ul>
        <li><a href="https://xogxog.com/wello?uuid=a1b2c3d4-e5f6-7890-abcd-ef1234567890&hospital=KHW001">안광수</a></li>
        <li><a href="https://xogxog.com/wello?uuid=3a96200c-c61a-47b1-8539-27b73ef2f483&hospital=KHW001">김영상</a></li>
        <li><a href="https://xogxog.com/wello?uuid=de6a7823-e45d-4a44-aea6-3d74bb8aa44c&hospital=KHW001">김태연</a></li>
        <li><a href="https://xogxog.com/wello?uuid=f1965784-b8fa-4c53-950d-ccdeffece2a4&hospital=KHW001">이준희</a></li>
        <li><a href="https://xogxog.com/wello?uuid=5838c130-f23c-4a2b-b8bc-7bbbef8fd7cf&hospital=KHW001">손충기</a></li>
        <li><a href="https://xogxog.com/wello?uuid=3c16602b-ec67-423d-8609-90af3ddfe52e&hospital=KHW001">성정옥 (신규)</a></li>
    </ul>
</body>
</html>
```

---

## 업데이트 일시
- 생성일: 2025-01-XX
- 마지막 업데이트: 2025-01-XX




