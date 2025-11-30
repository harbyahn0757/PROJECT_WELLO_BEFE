# 검진 항목 추천 화면 색상 토큰 매핑

## 개요
검진 항목 추천 화면에서 사용하는 모든 색상은 기존 디자인 토큰 시스템을 재사용합니다.
하드코딩된 색상값 사용을 금지하고, SCSS 변수(`_variables.scss`) 또는 CSS 변수(`design-tokens.css`)를 사용해야 합니다.

---

## 색상 토큰 매핑표

### 배경 색상

| 용도 | SCSS 변수 | CSS 변수 | 색상값 | 파일 위치 |
|------|-----------|----------|--------|-----------|
| 메인 배경 | `$background-cream` | `var(--bg-primary)` | `#FEF9EE` | `_variables.scss:21` |
| 카드 배경 | `$brand-brown-card` | - | `#E8DCC8` | `_variables.scss:17` |
| 의사 추천 박스 배경 | `$background-cream` 또는 `$brand-brown-card` | `var(--bg-primary)` | `#FEF9EE` 또는 `#E8DCC8` | - |

### 브라운 계열

| 용도 | SCSS 변수 | CSS 변수 | 색상값 | 파일 위치 |
|------|-----------|----------|--------|-----------|
| 제목 (추천 검진 항목) | `$brand-brown-darker` | `var(--color-brown-800)` | `#55433B` | `_variables.scss:14` |
| 버튼 배경 | `$brand-brown-darker` | `var(--color-brown-800)` | `#55433B` | `_variables.scss:14` |
| 뱃지 배경 | `$brand-brown-dark` | `var(--color-brown-600)` | `#A16A51` | `_variables.scss:13` |
| 아이콘 배경 | `$brand-brown-dark` | `var(--color-brown-600)` | `#A16A51` | `_variables.scss:13` |
| 체크박스 배경 | `$brand-brown-dark` | `var(--color-brown-600)` | `#A16A51` | `_variables.scss:13` |
| 의사 추천 박스 테두리 | `$brand-brown-dark` | `var(--color-brown-600)` | `#A16A51` | `_variables.scss:13` |

### 강조 색상

| 용도 | SCSS 변수 | CSS 변수 | 색상값 | 파일 위치 |
|------|-----------|----------|--------|-----------|
| 의사 추천 강조 텍스트 | `$error` 또는 `$badge-abnormal-bg` | `var(--color-danger)` | `#f56565` | `_variables.scss:81, 71` |

### 텍스트 색상

| 용도 | SCSS 변수 | CSS 변수 | 색상값 | 파일 위치 |
|------|-----------|----------|--------|-----------|
| 기본 텍스트 (환자 이름, 제목) | `$black` | `var(--text-primary)` | `#000000` | `_variables.scss:30` |
| 보조 텍스트 (설명) | `$gray-450` | `var(--text-secondary)` | `#565656` | `_variables.scss:39` |
| 설명 텍스트 (브라운톤) | `$brand-brown-text` | - | `#8B6F5E` | `_variables.scss:16` |
| 버튼 텍스트 | `$white` | `var(--text-inverse)` | `#ffffff` | `_variables.scss:29` |

---

## 사용 예시

### SCSS 사용법
```scss
@use '../styles/variables' as *;

.checkup-recommendations {
  background: $background-cream;
  
  &__title {
    color: $brand-brown-darker;
  }
  
  &__badge {
    background: $brand-brown-dark;
    color: $white;
  }
  
  &__button {
    background: $brand-brown-darker;
    color: $white;
  }
  
  &__doctor-box {
    background: $background-cream;
    border: 2px solid $brand-brown-dark;
    
    &-highlight {
      color: $error; // 강조 텍스트
    }
  }
}
```

### CSS 변수 사용법
```css
.checkup-recommendations {
  background: var(--bg-primary);
}

.checkup-recommendations__title {
  color: var(--color-brown-800);
}

.checkup-recommendations__badge {
  background: var(--color-brown-600);
  color: var(--text-inverse);
}

.checkup-recommendations__button {
  background: var(--color-brown-800);
  color: var(--text-inverse);
}

.checkup-recommendations__doctor-box {
  background: var(--bg-primary);
  border: 2px solid var(--color-brown-600);
}

.checkup-recommendations__doctor-box-highlight {
  color: var(--color-danger);
}
```

---

## 체크리스트

### 색상 사용 규칙
- [x] 모든 색상은 토큰 변수 사용 (하드코딩 금지)
- [x] SCSS 파일에서는 `$변수명` 사용
- [x] CSS 파일에서는 `var(--변수명)` 사용
- [x] 새로운 색상이 필요한 경우 `_variables.scss`에 추가 후 사용

### 금지 사항
- ❌ `color: #FEF9EE;` (하드코딩)
- ❌ `background: #A16A51;` (하드코딩)
- ✅ `color: $background-cream;` (토큰 사용)
- ✅ `background: var(--color-brown-600);` (CSS 변수 사용)

---

## 추가 토큰이 필요한 경우

만약 기존 토큰으로 표현할 수 없는 색상이 필요한 경우:

1. `_variables.scss`에 새로운 변수 추가
2. `design-tokens.css`에 CSS 변수 추가 (선택사항)
3. 이 문서에 매핑 정보 추가
4. 사용 예시 추가

예시:
```scss
// _variables.scss
$checkup-recommendation-accent: #새로운색상; // 검진 추천 전용 액센트 색상
```

---

## 참고 파일
- SCSS 변수: `/frontend/src/styles/_variables.scss`
- CSS 변수: `/frontend/src/styles/design-tokens.css`
- 색상 시스템 명세: `/docs/09_color_system_specification.md`






