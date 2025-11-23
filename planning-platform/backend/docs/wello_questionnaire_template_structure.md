# 웰로 질문 템플릿 구조

## 테이블 구조

### 1. questionnaire_templates (템플릿 메타데이터 및 스키마)

**주요 필드:**
- `id` (integer) - 기본키
- `content_type_id` (varchar) - 템플릿 타입 ID (예: "SEVERANCE_HEALTH_CHECKUP_001")
- `content_name` (varchar) - 템플릿 이름 (예: "세브란스 헬스체크업 문진표")
- `description` (text) - 설명
- `questionnaire_required` (boolean) - 문진 필수 여부
- `questionnaire_schema` (jsonb) - **JSON 스키마 (질문 구조 전체)**
- `questionnaire_validation` (jsonb) - 검증 규칙
- `hospital_id` (varchar) - 병원 ID
- `version` (integer) - 버전
- `is_active` (boolean) - 활성화 여부
- `created_at`, `updated_at` (timestamp) - 생성/수정 시간
- `created_by` (varchar) - 생성자
- `parent_template_id` (varchar) - 부모 템플릿 ID
- `change_history` (jsonb) - 변경 이력
- `template_family` (varchar) - 템플릿 패밀리
- `modification_type` (varchar) - 수정 타입

**현재 데이터:**
- 총 5개 템플릿
- 예시: "세브란스 헬스체크업 문진표", "김현우내과의원 국가일반검진 문진표"

### 2. question_groups (질문 그룹)

**주요 필드:**
- `group_id` (varchar) - 그룹 ID (기본키)
- `template_id` (varchar) - 템플릿 ID
- `hospital_id` (varchar) - 병원 ID
- `group_name` (varchar) - 그룹 이름 (예: "abdominal_surgery")
- `group_description` (text) - 그룹 설명
- `group_config` (jsonb) - 그룹 설정
- `display_order` (integer) - 표시 순서
- `is_collapsible` (boolean) - 접을 수 있는지 여부
- `is_collapsed` (boolean) - 기본 접힘 상태
- `created_at` (timestamptz) - 생성 시간

**현재 데이터:**
- 데이터 없음 (0건)

### 3. template_contents (실제 질문 내용)

**주요 필드:**
- `content_id` (integer) - 기본키
- `content_key` (varchar) - 질문 키 (예: "SEVERANCE_HEALTH_CHECKUP_001_31")
- `content_type` (varchar) - 컨텐츠 타입 (예: "question")
- `title` (jsonb) - 질문 제목 (다국어 지원, 예: `{"ko": "복부 수술을 하신 적이 있습니까?"}`)
- `description` (jsonb) - 설명 (다국어 지원)
- `placeholder` (text) - 플레이스홀더
- `help_text` (text) - 도움말
- `question_type` (varchar) - 질문 타입 (예: "radio", "text", "checkbox", "dropdown")
- `is_required` (boolean) - 필수 여부
- `options` (jsonb) - 선택지 (예: `[{"label": {"ko": "예"}, "value": "yes"}, {"label": {"ko": "아니오"}, "value": "no"}]`)
- `ui_config` (jsonb) - UI 설정
- `display_order` (integer) - 표시 순서
- `group_id` (varchar) - 그룹 ID (question_groups 참조)
- `parent_content_key` (varchar) - 부모 질문 키 (조건부 질문)
- `conditional_logic` (jsonb) - 조건부 로직
- `validation_rules` (jsonb) - 검증 규칙
- `hospital_id` (varchar) - 병원 ID
- `medical_category` (varchar) - 의료 카테고리
- `privacy_level` (varchar) - 개인정보 수준
- `content_hash` (varchar) - 컨텐츠 해시
- `created_at` (timestamptz) - 생성 시간
- `created_by` (varchar) - 생성자

**현재 데이터:**
- 여러 질문이 저장되어 있음
- 예시 질문: "복부 수술을 하신 적이 있습니까?" (radio 타입)

### 4. templates (템플릿 기본 정보)

**주요 필드:**
- `template_id` (varchar) - 템플릿 ID (기본키)
- `template_name` (varchar) - 템플릿 이름
- `template_description` (text) - 설명
- `hospital_id` (varchar) - 병원 ID
- `template_version` (integer) - 버전
- `template_type` (varchar) - 템플릿 타입
- `wello_config` (jsonb) - 웰로 설정
- `is_active` (boolean) - 활성화 여부
- `is_published` (boolean) - 게시 여부
- `created_by` (varchar) - 생성자
- `created_at`, `updated_at` (timestamptz) - 생성/수정 시간

**현재 데이터:**
- 데이터 없음 (0건)

## JSON 스키마 구조 (questionnaire_schema)

`questionnaire_templates.questionnaire_schema` 필드에 JSON 스키마 형식으로 저장됨:

```json
{
  "type": "object",
  "title": "템플릿 제목",
  "header": {
    "title": "헤더 제목",
    "logoUrl": "",
    "subtitle": "부제목"
  },
  "footer": {
    "text": "푸터 텍스트",
    "contactInfo": ""
  },
  "styling": {
    "colors": {
      "text": "#2d3748",
      "primary": "#7c746a",
      "background": "#f7e8d3"
    },
    "displayType": "multi_page",
    "sectionType": "both"
  },
  "required": ["필수_필드_리스트"],
  "properties": {
    "질문_키": {
      "type": "string",
      "title": "질문 제목",
      "widget": "dropdown|checkbox|text|radio",
      "enum": ["값1", "값2"],
      "enumNames": ["표시명1", "표시명2"],
      "description": "설명"
    }
  }
}
```

## 질문 타입 (question_type)

- `radio` - 라디오 버튼 (단일 선택)
- `checkbox` - 체크박스 (다중 선택)
- `text` - 텍스트 입력
- `dropdown` - 드롭다운 선택

## 옵션 구조 (options)

```json
[
  {
    "label": {
      "ko": "예",
      "en": "Yes"  // 다국어 지원
    },
    "value": "yes"
  },
  {
    "label": {
      "ko": "아니오",
      "en": "No"
    },
    "value": "no"
  }
]
```

## 제목/설명 구조 (title, description)

다국어 지원을 위한 JSON 구조:

```json
{
  "ko": "한국어 텍스트",
  "en": "English text"
}
```

## 데이터 흐름

1. **템플릿 생성**: `questionnaire_templates`에 템플릿 메타데이터와 JSON 스키마 저장
2. **질문 그룹**: `question_groups`에 질문 그룹 정의 (선택사항)
3. **질문 내용**: `template_contents`에 개별 질문 저장
4. **응답 저장**: `questionnaire_responses` 또는 `user_responses`에 사용자 응답 저장

## 현재 템플릿 예시

1. **세브란스 헬스체크업 문진표** (SEVERANCE_HEALTH_CHECKUP_001)
   - 병원: SEVERANCE_SEOUL
   - 버전: 1
   - 활성화: true

2. **김현우내과의원 국가일반검진 문진표** (KIM_HW_NATIONAL_HEALTH_CHECK_001)
   - 병원: KIM_HW_CLINIC
   - 버전: 2
   - 활성화: true

3. **메디링스병원 고객 만족도 조사** (MDXHOS_SATISFACTION_SURVEY_001)
   - 병원: MDXHOS
   - 버전: 1
   - 활성화: true

## 참고사항

- `questionnaire_templates`의 `questionnaire_schema`가 메인 스키마 구조
- `template_contents`는 개별 질문의 상세 정보
- `question_groups`는 질문을 그룹화하는 용도 (현재 데이터 없음)
- 다국어 지원: title, description, options의 label은 JSON 형식으로 다국어 저장
- 조건부 질문: `parent_content_key`와 `conditional_logic`로 구현

