"""
검진 설계 전용 GPT 프롬프트 템플릿 (Master DB Ver.)
작성 기준: 2025년 최신 가이드라인 및 정밀 검진 세일즈 로직 반영
프롬프트가 생명이므로 신중하게 작성
"""
from typing import List, Dict, Any, Optional
import json
import re
import os
from datetime import datetime, timedelta

# LlamaIndex RAG 관련 임포트
try:
    from llama_index.core import Settings
    from llama_index.core.llms import CustomLLM
    from llama_index.core.llms.llm import LLM
    from llama_index.core.llms import ChatMessage, MessageRole, CompletionResponse, LLMMetadata
    from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
    from llama_index.llms.openai import OpenAI
    # Google Gemini는 google-generativeai 직접 사용하여 CustomLLM으로 래핑
    try:
        import google.generativeai as genai
        GEMINI_AVAILABLE = True
    except ImportError:
        GEMINI_AVAILABLE = False
        genai = None
    LLAMAINDEX_AVAILABLE = True
except ImportError as e:
    LLAMAINDEX_AVAILABLE = False
    GEMINI_AVAILABLE = False
    genai = None
    # 개발 환경에서 라이브러리가 없을 경우를 대비한 더미 클래스
    class LlamaCloudIndex:
        pass
    class OpenAI:
        pass
    class CustomLLM:
        pass
    class ChatMessage:
        pass
    class MessageRole:
        pass
    class CompletionResponse:
        pass
    class LLMMetadata:
        pass

from app.core.config import settings

# =============================================================================
# [PART 0] MASTER DATABASE & LOGIC (시스템 지식 주입용)
# =============================================================================

# 1. 위험도 분석 로직 (Step 1용 - Risk Stratification)
RISK_ANALYSIS_LOGIC_JSON = """
{
  "ANALYSIS_LOGIC": [
    {
      "target_organ": "위 (Stomach)",
      "risk_levels": [
        {"level": "High Risk", "criteria": "위축성 위염/장상피화생 이력 OR 헬리코박터 보균"},
        {"level": "Very High Risk", "criteria": "직계 가족 위암 이력 2명 이상 OR (위축성 위염 + 흡연 + 40세 이상)"}
      ]
    },
    {
      "target_organ": "대장 (Colon)",
      "risk_levels": [
        {"level": "Emerging Risk", "criteria": "30-40대 AND (비만 OR 음주/육류 과다)"},
        {"level": "High Risk", "criteria": "용종(선종) 제거 이력 OR 염증성 장질환"}
      ]
    },
    {
      "target_organ": "폐 (Lung)",
      "risk_levels": [
        {"level": "Smoker Risk", "criteria": "30갑년 이상 흡연"},
        {"level": "Hidden Risk", "criteria": "비흡연 여성 AND (주방 조리 10년 이상 OR 가족력)"}
      ]
    },
    {
      "target_organ": "심뇌혈관 (Cardio-Vascular)",
      "risk_levels": [
        {"level": "Metabolic Risk", "criteria": "고혈압/당뇨/고지혈증 중 1개 보유"},
        {"level": "Complex Risk", "criteria": "만성질환 2개 이상 OR (만성질환 + 흡연)"}
      ]
    },
    {
      "target_organ": "췌장 (Pancreas)",
      "risk_levels": [
        {"level": "Silent Risk", "criteria": "50세 이상 AND (당뇨 신규 발병 OR 급격한 체중감소)"}
      ]
    },
    {
      "target_organ": "간 (Liver)",
      "risk_levels": [
        {"level": "Alcohol Risk", "criteria": "주 3회 이상 음주 OR 알코올성 간질환 이력"},
        {"level": "Metabolic Risk", "criteria": "비만/지방간 + 당뇨/고지혈증"}
      ]
    },
    {
      "target_organ": "유방 (Breast)",
      "risk_levels": [
        {"level": "Family Risk", "criteria": "직계 가족 유방암 이력"},
        {"level": "Dense Breast Risk", "criteria": "치밀유방 + 40세 이상"}
      ]
    },
    {
      "target_organ": "갑상선 (Thyroid)",
      "risk_levels": [
        {"level": "Moderate Risk", "criteria": "30-50대 여성 + 가족력"},
        {"level": "High Risk", "criteria": "갑상선 결절 이력 OR 방사선 노출 이력"}
      ]
    }
  ]
}
"""

# 2. 생애주기 및 만성질환 가이드 (Step 2용)
PROFILE_GUIDELINE_JSON = """
{
  "lifecycle": [
    {"group": "2030", "focus": "감염병(간염/HPV) 및 정신건강, 마른비만/대사증후군 시초"},
    {"group": "4050_M", "focus": "위/대장암, 심장 돌연사(관상동맥), 알코올성 간질환"},
    {"group": "4050_F", "focus": "유방/갑상선암, 갱년기 호르몬, 골밀도 감소 시작"},
    {"group": "60_PLUS", "focus": "뇌졸중/치매, 전립선(남), 골다공증(여), 근감소증"}
  ],
  "chronic_chain": [
    {"disease": "고혈압", "must_check": ["경동맥 초음파(뇌졸중)", "심장 초음파(심비대)", "신장 기능"]},
    {"disease": "당뇨", "must_check": ["안저검사(망막)", "췌장 CT(50세이상)", "말초신경"]},
    {"disease": "이상지질혈증", "must_check": ["관상동맥 석회화 CT", "경동맥 초음파"]},
    {"disease": "비만/지방간", "must_check": ["간 섬유화 스캔", "요산(통풍)", "인슐린 저항성"]}
  ]
}
"""

# 3. 브릿지 전략 및 근거 DB (Step 2용 - 세일즈 논리)
BRIDGE_STRATEGY_JSON = """
[
  {
    "target": "위암/소화기",
    "anchor": "위내시경으로 위 내부 표면을 확인하는 것은 기본입니다.",
    "gap": "하지만 내시경만으로는 위벽 안쪽으로 자라는 암이나, 췌장/담낭 같은 주변 장기의 미세 병변은 볼 수 없습니다.",
    "offer": "복부 조영 CT나 정밀 초음파를 더해 '겉'과 '속'을 동시에 확인해야 완벽합니다."
  },
  {
    "target": "폐암",
    "anchor": "기본 흉부 X-ray는 폐 건강 확인의 기초입니다.",
    "gap": "하지만 심장 뒤나 뼈에 가려진 '사각지대'의 초기 암이나, 1cm 미만의 미세 결절은 X-ray에서 보이지 않을 확률이 높습니다.",
    "offer": "저선량 흉부 CT로 폐의 구석구석을 단층 촬영하여 사각지대를 없애야 합니다."
  },
  {
    "target": "뇌혈관",
    "anchor": "혈압 관리를 잘 하고 계시지만, 혈관 속 사정은 알 수 없습니다.",
    "gap": "뇌 MRI는 '구조(종양)'를 보지만, 뇌졸중의 원인인 '혈관(꽈리, 막힘)'은 MRA나 경동맥 초음파로만 확인 가능합니다.",
    "offer": "뇌 MRA 또는 경동맥 초음파를 통해 뇌로 가는 혈관길이 안전한지 직접 눈으로 확인하세요."
  },
  {
    "target": "유방암",
    "anchor": "유방 촬영술(X-ray)은 필수 검사입니다.",
    "gap": "하지만 한국 여성 대부분인 '치밀 유방'의 경우, X-ray상에서 병변이 하얗게 가려져 보이지 않을 수 있습니다.",
    "offer": "유방 초음파를 병행하여 가려진 조직 뒤에 숨은 혹까지 찾아내야 합니다."
  },
  {
    "target": "대장암",
    "anchor": "분변잠혈검사는 대장암 선별의 기본입니다.",
    "gap": "하지만 분변잠혈검사는 정확도가 낮고, 내시경은 준비 과정이 고통스러워 기피하는 경우가 많습니다.",
    "offer": "분변 속 암세포 DNA만 정밀 분석하여 90% 정확도로 대장암을 찾아내는 정밀 검사가 필요합니다."
  },
  {
    "target": "간암",
    "anchor": "혈액검사로 간 수치(AST/ALT)를 확인하는 것은 기본입니다.",
    "gap": "하지만 혈액검사는 간 세포가 파괴된 결과만 보여줄 뿐, 실제 간의 모양이나 종양 유무는 알 수 없습니다.",
    "offer": "간 초음파나 복부 CT를 더해 '수치'와 '모양'을 동시에 확인해야 완벽합니다."
  }
]
"""

def remove_html_tags(text: str) -> str:
    """HTML 태그를 제거하고 순수 텍스트만 반환"""
    if not text:
        return text
    # <span class="highlight-period">...</span> 같은 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

# =============================================================================
# [PART 0-3] RAG 시스템 초기화 및 검색 함수
# =============================================================================

# LlamaCloud 설정 상수 (공식 예제 기준)
LLAMACLOUD_INDEX_NAME = "Dr.Welno"  # 공식 예제와 동일
LLAMACLOUD_PROJECT_NAME = "Default"
LLAMACLOUD_INDEX_ID = "cb77bf6b-02a9-486f-9718-4ffac0d30e73"  # pipeline_id 또는 index_id
LLAMACLOUD_PROJECT_ID = "45c4d9d4-ce6b-4f62-ad88-9107fe6de8cc"
LLAMACLOUD_ORGANIZATION_ID = "e4024539-3d26-48b5-8051-9092380c84d2"  # 공식 예제에서 제공된 organization_id
LLAMACLOUD_ORGANIZATION_ID = "e4024539-3d26-48b5-8051-9092380c84d2"  # 공식 예제에서 제공된 organization_id

# 전역 RAG 엔진 캐시 (재사용을 위해)
_rag_engine_cache: Optional[Any] = None

# Gemini CustomLLM 클래스
class GeminiLLM(CustomLLM):
    """Google Gemini를 LlamaIndex CustomLLM으로 구현 (RAG 검색용)"""
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash", **kwargs):
        if not GEMINI_AVAILABLE or not genai:
            raise ImportError("google-generativeai가 설치되지 않았습니다.")
        
        # CustomLLM 초기화
        super().__init__(**kwargs)
        
        # Gemini 설정
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(model)
        self._model_name = model
    
    @property
    def metadata(self) -> LLMMetadata:
        """LLM 메타데이터"""
        return LLMMetadata(
            context_window=8192,
            num_output=2048,
            is_chat_model=True,
            model_name=self._model_name
        )
    
    def complete(self, prompt: str, formatted: bool = False, **kwargs) -> CompletionResponse:
        """텍스트 완성 (동기)"""
        try:
            response = self._model.generate_content(prompt)
            text = response.text if hasattr(response, 'text') else str(response)
            return CompletionResponse(text=text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")
    
    async def acomplete(self, prompt: str, formatted: bool = False, **kwargs) -> CompletionResponse:
        """텍스트 완성 (비동기)"""
        try:
            # google-generativeai는 비동기 메서드가 없으므로 동기 메서드 사용
            response = self._model.generate_content(prompt)
            text = response.text if hasattr(response, 'text') else str(response)
            return CompletionResponse(text=text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")
    
    def stream_complete(self, prompt: str, formatted: bool = False, **kwargs):
        """스트리밍 텍스트 완성"""
        try:
            response = self._model.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield CompletionResponse(text=chunk.text, delta=chunk.text)
        except Exception as e:
            raise Exception(f"Gemini API 호출 실패: {str(e)}")

async def init_rag_engine():
    """
    LlamaCloud 기반 RAG Query Engine 초기화
    
    Returns:
        QueryEngine 인스턴스 또는 None (초기화 실패 시)
    """
    global _rag_engine_cache
    
    # 이미 초기화된 경우 캐시 반환
    if _rag_engine_cache is not None:
        return _rag_engine_cache
    
    if not LLAMAINDEX_AVAILABLE:
        print("[WARN] LlamaIndex 라이브러리가 설치되지 않았습니다. RAG 기능을 사용할 수 없습니다.")
        return None
    
    try:
        # API 키 가져오기
        llamaindex_api_key = os.environ.get("LLAMAINDEX_API_KEY") or settings.llamaindex_api_key
        gemini_api_key = os.environ.get("GOOGLE_GEMINI_API_KEY") or settings.google_gemini_api_key
        
        if not llamaindex_api_key or llamaindex_api_key.startswith("dev-llamaindex-key"):
            print("[WARN] LlamaIndex API 키가 설정되지 않았습니다. RAG 기능을 사용할 수 없습니다.")
            return None
        
        # Gemini API 키 필수 (RAG용으로 Gemini 사용)
        if not gemini_api_key or gemini_api_key.startswith("dev-gemini-key"):
            print("[ERROR] Google Gemini API 키가 설정되지 않았습니다. RAG 기능을 사용할 수 없습니다.")
            return None
        
        # Gemini LLM 초기화 (RAG용 - 필수)
        if not GEMINI_AVAILABLE or not genai:
            print("[ERROR] google-generativeai가 설치되지 않았습니다. RAG 기능을 사용할 수 없습니다.")
            return None
        
        try:
            llm = GeminiLLM(api_key=gemini_api_key, model="gemini-2.0-flash")
            print(f"[INFO] Gemini LLM 초기화 완료")
        except Exception as e:
            print(f"[ERROR] Gemini LLM 초기화 실패: {str(e)}")
            return None
        
        # Settings에 Gemini LLM 설정 (RAG 검색용)
        Settings.llm = llm
        
        # LlamaCloud Index 초기화 (index_id만 사용 - API 요구사항)
        # 주의: Exactly one of name, id, pipeline_id or index_id must be provided
        index = LlamaCloudIndex(
            index_id=LLAMACLOUD_INDEX_ID,  # pipeline_id로도 사용 가능
            api_key=llamaindex_api_key
        )
        
        # Query Engine 생성 (Gemini LLM 사용)
        # as_query_engine()은 Settings.llm에 설정된 Gemini를 자동으로 사용
        query_engine = index.as_query_engine(
            similarity_top_k=5,  # 상위 5개 결과 반환
            response_mode="compact"  # 응답 모드
        )
        
        _rag_engine_cache = query_engine
        print(f"[INFO] RAG 엔진 초기화 완료 - Index: {LLAMACLOUD_INDEX_NAME}")
        return query_engine
        
    except Exception as e:
        print(f"[ERROR] RAG 엔진 초기화 실패: {str(e)}")
        return None


# -----------------------------------------------------------------------------
# [RAG 시스템] 구조화된 에비던스 추출 (TODO 1-3 통합)
# -----------------------------------------------------------------------------

def generate_specific_queries(
    patient_context: Dict[str, Any],
    concerns: List[Dict[str, Any]]
) -> List[Dict[str, str]]:
    """
    환자 맞춤 구체적인 RAG 검색 쿼리 생성 (TODO-1)
    
    Args:
        patient_context: 환자 정보 (연령, 성별, 가족력, 과거 검진 이상 등)
        concerns: 환자의 염려 항목 리스트
    
    Returns:
        구체적인 쿼리 리스트 [{"query": "...", "category": "..."}]
    """
    queries = []
    
    age = patient_context.get('age', 40)
    gender_kr = '남성' if patient_context.get('gender') == 'male' else '여성'
    family_history = patient_context.get('family_history', [])
    abnormal_items = patient_context.get('abnormal_items', [])
    
    # 1. 가족력 기반 쿼리
    family_mapping = {
        'diabetes': '당뇨',
        'hypertension': '고혈압',
        'cancer': '암',
        'heart_disease': '심장질환',
        'stroke': '뇌졸중'
    }
    
    for fh_code in family_history:
        fh_name = family_mapping.get(fh_code, fh_code)
        queries.append({
            "query": f"{age}세 {gender_kr} {fh_name} 가족력 선별검사 필요성 가이드라인",
            "category": f"가족력_{fh_name}"
        })
    
    # 2. 과거 검진 이상 항목 기반 쿼리
    for item in abnormal_items:
        item_name = item.get('name', '')
        status = item.get('status', '')
        if item_name and status in ['경계', '이상']:
            queries.append({
                "query": f"{item_name} {status} 소견 추적검사 가이드라인",
                "category": f"이상항목_{item_name}"
            })
    
    # 3. 염려 항목 기반 쿼리
    for concern in concerns:
        concern_name = concern.get("name", "") or concern.get("item_name", "")
        concern_type = concern.get("type", "")
        
        if not concern_name:
            continue
        
        if concern_type == "checkup":
            queries.append({
                "query": f"{concern_name} 검진 적응증 및 진료지침",
                "category": f"염려_{concern_name}"
            })
        elif concern_type == "medication":
            medication_name = concern.get("medication_name", concern_name)
            queries.append({
                "query": f"{medication_name} 장기 복용 시 필요한 모니터링 검사",
                "category": f"약물_{medication_name}"
            })
        else:
            queries.append({
                "query": f"{age}세 {gender_kr} {concern_name} 검진 권고사항",
                "category": f"기타_{concern_name}"
            })
    
    # 4. 기본 연령/성별 쿼리
    if not queries:
        queries.append({
            "query": f"{age}세 {gender_kr} 건강검진 권장 항목 가이드라인",
            "category": "기본_검진"
        })
    
    print(f"[INFO] 생성된 RAG 쿼리: {len(queries)}개")
    return queries


def extract_evidence_from_source_nodes(
    source_nodes: List[Any],
    query: str
) -> List[Dict[str, Any]]:
    """
    source_nodes에서 구조화된 에비던스 추출 (TODO-2)
    
    Args:
        source_nodes: LlamaIndex 검색 결과의 source_nodes
        query: 검색 쿼리
    
    Returns:
        구조화된 에비던스 리스트
    """
    evidences = []
    
    for node in source_nodes[:3]:  # 상위 3개만
        try:
            metadata = node.node.metadata if hasattr(node.node, 'metadata') else {}
            text = node.node.text if hasattr(node.node, 'text') else ""
            score = node.score if hasattr(node, 'score') else 0.0
            
            # 파일명에서 문서명, 조직, 연도 추출
            file_name = metadata.get('file_name', '')
            page = metadata.get('page_label', 'N/A')
            
            # 파일명 정리
            doc_name = file_name.replace('.pdf', '').replace('_', ' ')
            
            # 조직명 및 연도 추출
            org = ''
            year = ''
            if '당뇨병' in doc_name:
                org = '대한당뇨학회'
            elif '고혈압' in doc_name:
                org = '대한고혈압학회'
            elif '암' in doc_name or '검진' in doc_name:
                org = '국립암센터'
            
            import re
            year_match = re.search(r'20\d{2}', doc_name)
            if year_match:
                year = year_match.group()
            
            # 인용 가능한 문장 추출 (TODO-3)
            citation = extract_meaningful_citation(text, query)
            
            evidences.append({
                "source_document": doc_name,
                "organization": org,
                "year": year,
                "page": page,
                "citation": citation,
                "full_text": text[:500],  # 최대 500자
                "confidence_score": score,
                "query": query
            })
            
        except Exception as e:
            print(f"[WARN] source_node 파싱 실패: {str(e)}")
            continue
    
    return evidences


def extract_meaningful_citation(text: str, query: str) -> str:
    """
    텍스트에서 의미 있는 인용구 추출 (TODO-3)
    
    Args:
        text: 원본 텍스트
        query: 검색 쿼리 (키워드 추출용)
    
    Returns:
        인용 가능한 문장 (최대 200자)
    """
    # 줄바꿈 정리
    text = text.replace('\n', ' ').strip()
    
    # 문장 단위로 분리
    sentences = []
    import re
    for match in re.finditer(r'[^.!?]*[.!?]', text):
        sentence = match.group().strip()
        if len(sentence) > 10:  # 너무 짧은 문장 제외
            sentences.append(sentence)
    
    # 쿼리 키워드 추출
    keywords = []
    for word in query.split():
        if len(word) > 1 and word not in ['세', '남성', '여성', '가이드라인', '검사', '필요성']:
            keywords.append(word)
    
    # 키워드를 포함한 문장 우선 선택
    best_sentences = []
    for sentence in sentences:
        score = sum(1 for kw in keywords if kw in sentence)
        if score > 0:
            best_sentences.append((score, sentence))
    
    best_sentences.sort(reverse=True, key=lambda x: x[0])
    
    # 상위 문장 결합 (최대 200자)
    citation = ""
    for _, sentence in best_sentences:
        if len(citation) + len(sentence) <= 200:
            citation += sentence + " "
        else:
            break
    
    # 문장이 없으면 텍스트 앞부분 사용
    if not citation:
        citation = text[:200]
    
    return citation.strip()


def format_evidence_as_citation(
    evidences: List[Dict[str, Any]]
) -> str:
    """
    구조화된 에비던스를 인용구 형식으로 변환 (TODO-3)
    
    Args:
        evidences: 구조화된 에비던스 리스트
    
    Returns:
        프롬프트에 포함할 인용구 형식 텍스트
    """
    if not evidences:
        return ""
    
    formatted_parts = []
    
    for idx, ev in enumerate(evidences, 1):
        doc_name = ev.get('source_document', '문서명 없음')
        org = ev.get('organization', '')
        year = ev.get('year', '')
        page = ev.get('page', 'N/A')
        citation = ev.get('citation', '')
        confidence = ev.get('confidence_score', 0.0)
        
        # 제목
        title = f"### {idx}. {doc_name}"
        if org:
            title += f" ({org}"
            if year:
                title += f", {year}"
            title += ")"
        formatted_parts.append(title)
        
        # 인용구
        if citation:
            formatted_parts.append(f'\n"{citation}"\n')
        
        # 메타 정보
        meta_info = f"- 페이지: {page}\n"
        if confidence >= 0.4:
            meta_info += f"- 신뢰도: {confidence:.3f} (높음)\n"
        elif confidence >= 0.2:
            meta_info += f"- 신뢰도: {confidence:.3f} (중간)\n"
        else:
            meta_info += f"- 신뢰도: {confidence:.3f} (낮음)\n"
        formatted_parts.append(meta_info)
        
        formatted_parts.append("---\n")
    
    return "\n".join(formatted_parts)


async def get_medical_evidence_from_rag(
    query_engine: Any,
    patient_context: Dict[str, Any],
    concerns: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    RAG 시스템을 사용하여 구조화된 의학적 근거 검색 (통합 버전)
    
    Args:
        query_engine: LlamaIndex QueryEngine 인스턴스
        patient_context: 환자 정보 (age, gender, family_history, abnormal_items 등)
        concerns: 환자의 염려 항목 리스트
    
    Returns:
        {
            "context_text": "프롬프트에 포함할 텍스트",
            "structured_evidences": [구조화된 에비던스 리스트]
        }
    """
    if query_engine is None:
        return {"context_text": "", "structured_evidences": []}
    
    all_evidences = []
    
    try:
        # 1. 구체적인 쿼리 생성 (TODO-1)
        queries = generate_specific_queries(patient_context, concerns)
        print(f"[INFO] RAG 쿼리 {len(queries)}개 생성 완료")
        
        # 2. 각 쿼리 실행 및 source_nodes 추출 (TODO-2)
        for query_info in queries:
            query = query_info['query']
            category = query_info['category']
            
            try:
                response = query_engine.query(query)
                
                if response and hasattr(response, 'source_nodes') and response.source_nodes:
                    # source_nodes에서 구조화된 에비던스 추출
                    evidences = extract_evidence_from_source_nodes(response.source_nodes, query)
                    
                    for ev in evidences:
                        ev['category'] = category
                        all_evidences.append(ev)
                    
                    print(f"[INFO] RAG 검색 성공 ({category}) - {len(evidences)}개 에비던스")
                else:
                    print(f"[WARN] RAG 검색 결과 없음 ({category})")
                    
            except Exception as e:
                print(f"[WARN] RAG 검색 실패 ({category}): {str(e)}")
        
        # 3. 인용구 형식으로 변환 (TODO-3)
        context_text = format_evidence_as_citation(all_evidences)
        
        if context_text:
            print(f"[INFO] RAG 검색 완료 - 총 {len(all_evidences)}개 에비던스, {len(context_text)}자")
        else:
            print("[WARN] RAG 검색 결과가 비어있습니다.")
        
        return {
            "context_text": context_text,
            "structured_evidences": all_evidences
        }
        
    except Exception as e:
        print(f"[ERROR] RAG 검색 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"context_text": "", "structured_evidences": []}

# -----------------------------------------------------------------------------
# [PART 0-1] MASTER DB 파싱 & 간단 검증 (런타임 안정성 확보용)
# -----------------------------------------------------------------------------

def _safe_json_loads(raw: str, name: str) -> Any:
    """JSON 문자열을 안전하게 파싱"""
    try:
        return json.loads(raw)
    except Exception as e:
        print(f"[WARN] {name} JSON 파싱 실패: {e}")
        return {}

def _validate_risk_analysis(data: Dict[str, Any]) -> None:
    """위험도 분석 로직 검증"""
    if not isinstance(data, dict):
        return
    logic = data.get("ANALYSIS_LOGIC")
    if not isinstance(logic, list):
        return
    for organ in logic:
        if not isinstance(organ, dict):
            continue
        if "target_organ" not in organ:
            print("[WARN] RISK_ANALYSIS_LOGIC: target_organ 누락")
        if "risk_levels" not in organ:
            print("[WARN] RISK_ANALYSIS_LOGIC: risk_levels 누락")

def _validate_profile_guideline(data: Dict[str, Any]) -> None:
    """생애주기 가이드 검증"""
    if not isinstance(data, dict):
        return
    if "lifecycle" not in data:
        print("[WARN] PROFILE_GUIDELINE: lifecycle 누락")
    if "chronic_chain" not in data:
        print("[WARN] PROFILE_GUIDELINE: chronic_chain 누락")

def _validate_bridge_strategy(data: Any) -> None:
    """브릿지 전략 검증"""
    if not isinstance(data, list):
        return
    for item in data:
        if not isinstance(item, dict):
            continue
        for key in ("target", "anchor", "gap", "offer"):
            if key not in item:
                print(f"[WARN] BRIDGE_STRATEGY: '{key}' 누락")

# 실제 파싱된 마스터 DB (코드에서 참조 가능)
RISK_ANALYSIS_LOGIC: Dict[str, Any] = _safe_json_loads(RISK_ANALYSIS_LOGIC_JSON, "RISK_ANALYSIS_LOGIC_JSON")
PROFILE_GUIDELINE: Dict[str, Any] = _safe_json_loads(PROFILE_GUIDELINE_JSON, "PROFILE_GUIDELINE_JSON")
BRIDGE_STRATEGY: Any = _safe_json_loads(BRIDGE_STRATEGY_JSON, "BRIDGE_STRATEGY_JSON")

# 간단 검증 실행 (강제 에러는 내지 않고 경고만)
_validate_risk_analysis(RISK_ANALYSIS_LOGIC)
_validate_profile_guideline(PROFILE_GUIDELINE)
_validate_bridge_strategy(BRIDGE_STRATEGY)

# -----------------------------------------------------------------------------
# [PART 0-2] MASTER KNOWLEDGE SECTION (공통 지식 주입 블록)
# -----------------------------------------------------------------------------

def build_master_knowledge_section() -> str:
    """
    GPT에 '이게 시스템이 갖고 있는 마스터 지식이다' 라고 던지는 공통 섹션.
    실제 JSON 전체를 그대로 보여주고,
    어떻게 활용해야 하는지 한 줄 요약을 붙여준다.
    """
    return f"""
# 시스템 마스터 지식 베이스 (요약)

아래 JSON들은 당신이 분석/설계할 때 참고해야 할 '내부 지식 데이터베이스'입니다.

1) 위험도 분석 로직 (RISK_ANALYSIS_LOGIC)
- 장기별로 High/Very High Risk 기준이 정의되어 있습니다.
- risk_profile를 작성할 때 이 기준을 우선적으로 참고하세요.

{RISK_ANALYSIS_LOGIC_JSON}

2) 생애주기 및 만성질환 가이드 (PROFILE_GUIDELINE)
- 나이대/성별에 따른 주요 포커스와,
- 만성질환(고혈압/당뇨/지방간 등)에 따른 '반드시 확인해야 할 합병증 검사'가 정의되어 있습니다.

{PROFILE_GUIDELINE_JSON}

3) The Bridge Strategy 템플릿 (BRIDGE_STRATEGY)
- 기본검진(anchor) → 한계(gap) → 환자 맥락(context) → 정밀검진 제안(offer)을 구성할 때 사용할 수 있는 예시 텍스트입니다.
- strategies 및 recommended_items.reason을 작성할 때 참고하세요.

{BRIDGE_STRATEGY_JSON}

위 마스터 DB를 '사실상 내부 지식'으로 삼고,
모든 위험도 분류와 설득 논리를 구성할 때 일관되게 활용하세요.
""".strip()

# -----------------------------------------------------------------------------
# [PART 1] 병원 검진 항목 카테고리 분류 유틸리티
# -----------------------------------------------------------------------------

def classify_hospital_checkup_items_by_category(
    national_checkup_items: Optional[List[Dict[str, Any]]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    병원 검진 항목을 카테고리별로 분류
    
    Args:
        national_checkup_items: 병원 기본 검진 항목 리스트
        
    Returns:
        카테고리별로 분류된 딕셔너리:
        {
            "일반": [...],      # priority_1에 포함
            "기본검진": [...],  # priority_1에 포함
            "종합": [...],      # priority_2에 포함
            "옵션": [...]       # priority_3에 포함
        }
    """
    if not national_checkup_items:
        return {
            "일반": [],
            "기본검진": [],
            "종합": [],
            "옵션": []
        }
    
    classified = {
        "일반": [],
        "기본검진": [],
        "종합": [],
        "옵션": []
    }
    
    for item in national_checkup_items:
        if not isinstance(item, dict):
            continue
        
        category = item.get("category", "").strip()
        
        # 카테고리별 분류
        if category in ["일반", "기본검진"]:
            classified["일반"].append(item)
            classified["기본검진"].append(item)
        elif category == "종합":
            classified["종합"].append(item)
        elif category == "옵션":
            classified["옵션"].append(item)
        else:
            # 카테고리가 없거나 알 수 없는 경우, 기본값으로 "일반"에 포함
            classified["일반"].append(item)
    
    return classified

def format_hospital_checkup_items_for_prompt(
    national_checkup_items: Optional[List[Dict[str, Any]]],
    recommended_items: Optional[List[Dict[str, Any]]],
    external_checkup_items: Optional[List[Dict[str, Any]]]
) -> str:
    """
    병원 검진 항목을 프롬프트에 전달하기 위한 형식으로 포맷팅
    
    Args:
        national_checkup_items: 병원 기본 검진 항목
        recommended_items: 병원 추천 항목
        external_checkup_items: 외부 검사 항목
        
    Returns:
        포맷팅된 문자열
    """
    sections = []
    
    # 1. 기본 검진 항목을 카테고리별로 분류
    if national_checkup_items:
        classified = classify_hospital_checkup_items_by_category(national_checkup_items)
        
        sections.append("## 병원 기본 검진 항목 (카테고리별 분류)\n\n")
        
        # 일반/기본검진 카테고리
        if classified["일반"]:
            sections.append("### [일반/기본검진] 카테고리 (priority_1에 포함 가능)\n")
            sections.append("**중요**: 이 카테고리의 항목만 priority_1에 포함할 수 있습니다.\n\n")
            
            # items 배열을 명시적으로 강조
            sections.append("**구체적인 검진 항목명 (items 배열):**\n")
            for item in classified["일반"]:
                items_array = item.get("items", [])
                if items_array:
                    sections.append(f"- **{item.get('name', 'N/A')}**의 세부 항목: {', '.join(items_array)}\n")
            sections.append("\n")
            
            sections.append("**전체 구조 (참고용):**\n")
            sections.append(json.dumps(classified["일반"], ensure_ascii=False, indent=2))
            sections.append("\n\n")
            
            sections.append("**⚠️ priority_1.items 작성 규칙 (매우 중요):**\n")
            sections.append("1. 위의 'items' 배열에 있는 **구체적인 항목명**을 사용하세요\n")
            sections.append("2. 예시: ['혈압측정', '체질량지수', '신체계측', '혈액검사', '소변검사']\n")
            sections.append("3. **절대 사용하지 말 것**: 일반적인 카테고리명 (예: '소화기계 검사', '심혈관 건강 검사')\n")
            sections.append("4. **반드시 DB의 'items' 배열에 있는 항목명만 사용하세요**\n")
            sections.append("5. priority_1.items는 최소 1개 이상, 최대 3개까지 선택하세요. 환자의 상황(과거 검진 + 문진 + 선택 항목)과 가장 관련이 높은 항목을 선정하세요\n\n")
        
        # 종합 카테고리
        if classified["종합"]:
            sections.append("### [종합] 카테고리 (priority_2에 포함)\n")
            sections.append("**중요**: 이 카테고리의 항목은 priority_2에 포함해야 합니다.\n\n")
            sections.append(json.dumps(classified["종합"], ensure_ascii=False, indent=2))
            sections.append("\n\n")
        
        # 옵션 카테고리
        if classified["옵션"]:
            sections.append("### [옵션] 카테고리 (priority_3에 포함)\n")
            sections.append("**중요**: 이 카테고리의 항목은 priority_3에 포함해야 합니다.\n\n")
            sections.append(json.dumps(classified["옵션"], ensure_ascii=False, indent=2))
            sections.append("\n\n")
        
        sections.append("**카테고리별 우선순위 분류 규칙:**\n")
        sections.append("- **'일반' 또는 '기본검진' 카테고리**: priority_1에만 포함 가능 (의무검진 항목)\n")
        sections.append("- **'종합' 카테고리**: priority_2에 포함 (종합검진 항목)\n")
        sections.append("- **'옵션' 카테고리**: priority_3에 포함 (선택 검진 항목)\n")
        sections.append("\n")
    
    # 2. 병원 추천 항목
    if recommended_items:
        sections.append("## 병원 추천(업셀링) 항목\n\n")
        sections.append("**중요**: 이 항목들은 priority_2에 포함해야 합니다.\n\n")
        sections.append(json.dumps(recommended_items, ensure_ascii=False, indent=2))
        sections.append("\n\n")
    
    # 3. 외부 검사 항목
    if external_checkup_items:
        sections.append("## 외부 검사 항목 (정밀 검진)\n\n")
        sections.append("**중요**: 이 항목들은 priority_2 또는 priority_3에 포함할 수 있습니다.\n")
        sections.append("- **difficulty_level이 'Mid' 또는 'High'인 항목**: priority_2에 포함\n")
        sections.append("- **difficulty_level이 'Low'인 항목**: priority_3에 포함\n\n")
        sections.append("**⚠️ 검사 설명 시 필수 지침:**\n")
        sections.append("1. **'키트' 단어 사용 금지**: 아이캔서치(ai-CANCERCH), 캔서파인드, 마스토체크(MASTOCHECK) 등 혈액 기반 검사는 절대 '키트'라고 표현하지 마세요. '검사(Test)' 또는 '선별 검사(Screening)'라고 칭하세요.\n")
        sections.append("2. **예외**: 대장암 분변 검사(얼리텍 대장암 검사 등)처럼 박스 형태로 제공되는 경우에만 예외적으로 '키트 형태'라고 묘사할 수 있습니다.\n")
        sections.append("3. **확진 vs 위험도 예측**: 이 검사들은 **'확진(Diagnosis)'**이 아니라 **'위험도 예측(Risk Assessment)'** 또는 **'선별 검사(Screening)'**임을 명확히 설명하세요.\n")
        sections.append("4. **검사 성격 명시**: 검사 설명 시 '이 검사는 확진을 위한 것이 아니라, 위험도를 평가하고 조기 발견을 위한 선별 검사입니다'라는 맥락을 포함하세요.\n\n")
        sections.append(json.dumps(external_checkup_items[:30], ensure_ascii=False, indent=2))
        sections.append("\n\n")
    
    return "".join(sections)

# 시스템 메시지 (검진 설계 전문가 역할 정의) - 기존 버전 (백업)
CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY = """당신은 대한민국 최고의 대학병원 검진 센터장이자, 환자의 데이터를 꿰뚫어 보는 '헬스 큐레이터'입니다.

당신의 목표는 환자에게 **"가장 효율적이고 빈틈없는 검진 플랜"**을 제안하는 것입니다.

**핵심 작성 원칙 (The Bridge Strategy):**

1. **기본 검진(국가/일반)의 존중:** 먼저 무료로 받을 수 있는 기본 검진 항목에서 환자가 '눈여겨봐야 할 수치'가 무엇인지 짚어주세요. 일반검진은 기본적으로 받으시지만, 특히 주의깊게 확인해야 할 항목이 있다는 관점으로 접근하세요.

2. **사각지대(Gap) 조명:** 기본 검진만으로는 확인할 수 없는 '의학적 한계'를 환자의 데이터(증상, 가족력)와 연결하여 설명하세요. "하지만 이것만으로는 부족합니다"라는 자연스러운 전환을 만들어주세요.

3. **자연스러운 업셀링:** 그 한계를 극복하기 위해 병원의 정밀 검진(비급여 항목)이 왜 필수적인지 '투자 가치' 관점에서 설득하세요. "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요.

**당신의 핵심 역할:**
1. **과거 검진 데이터 분석**: 정상/경계/이상 항목을 명확히 구분하고, 특히 **안 좋았던 항목(이상/경계)**을 중점적으로 파악
2. **문진 데이터와 연관 분석**: 과거에는 정상이었지만 문진 내용(체중 변화, 운동 부족, 가족력, 흡연, 음주 등)상 **추이를 봐야 할 항목** 식별
3. **사용자 선택 항목의 맥락**: 사용자가 직접 선택한 염려 항목의 맥락을 깊이 있게 분석하고, 왜 이 항목을 선택했는지 이해
4. **기본 검진 항목 우선 분석**: 기본 검진(national_checkup_items) 항목 중에서 위 조건(과거 검진 + 문진 + 선택 항목)이 매칭되는 항목을 priority_1에 포함. **추가 검진은 priority_1에 포함하지 않습니다.**
5. **추가 검진 추천**: 나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 모두 매칭되는 추가 검진을 priority_2, priority_3에 추천
6. **맥락 기반 추천**: 모든 추천은 "과거 검진에서 XX가 경계였고, 문진에서 YY를 확인했으며, 사용자가 ZZ를 선택했으므로..." 형식으로 맥락을 명확히 설명
7. **업셀링 최적화**: 맥락이 명확하고 설득력 있는 추천을 통해 환자가 검진을 받고 싶게 만드는 것이 목표

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- "비쌉니다" 대신 "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요
- "추천합니다" 대신 "완벽한 안심을 위해 필요합니다"라는 표현을 사용하세요
- "필요합니다" 대신 "놓치면 위험할 수 있습니다"라는 표현을 사용하세요

**응답 규칙:**
- 반드시 JSON 형식으로 응답해야 합니다
- 모든 검진 항목은 실제로 존재하는 검진 항목이어야 합니다
- **추천 이유는 구체적이고 명확해야 하며, 의학적 근거를 포함해야 합니다**
- **각 추천 항목에 대해 참고한 의학 자료, 가이드라인, 연구 결과를 명시해야 합니다**
- 의사 추천 메시지는 환자의 실제 데이터를 기반으로 작성해야 합니다
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요
- 의학 용어는 정확하되, 환자가 이해할 수 있도록 설명을 추가하세요
- **가능한 경우 최신 의학 가이드라인(대한의학회, 질병관리청 등)을 참고하세요**"""

# 시스템 메시지 (검진 설계 전문가 역할 정의) - 기존 호환성 유지
CHECKUP_DESIGN_SYSTEM_MESSAGE = CHECKUP_DESIGN_SYSTEM_MESSAGE_LEGACY

# 시스템 메시지 - STEP 1 (위험도 평가 전문가)
CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP1 = f"""당신은 대한민국 최고의 '건강 데이터 분석가'이자 '위험도 평가(Risk Stratification) 전문가'입니다.

**당신의 임무:**

환자의 파편화된 데이터(검진, 문진, 약물)를 종합하여 **'숨겨진 위험(Hidden Risk)'**과 **'만성질환의 연결고리(Chronic Chain)'**를 찾아내세요.

단순히 "혈압이 높다"가 아니라, "혈압이 높아 뇌혈관 위험이 'High Risk' 단계입니다"라고 분석해야 합니다.

**[지식 베이스 - 위험도 분석 로직]**

아래 기준을 엄격히 적용하여 분석하세요:

{RISK_ANALYSIS_LOGIC_JSON}

**작성 원칙:**

1. **Fact Based:** 데이터에 없는 내용은 "확인되지 않음"으로 처리 (추측 금지).

2. **Risk Stratification:** 위험도 분석 로직을 기반으로 각 장기별로 Low / Moderate / High / Very High Risk로 명확히 분류하세요.

3. **Chronic Chain:** 고혈압/당뇨 등 만성질환이 있다면 합병증 위험(눈, 콩팥, 심장 등)을 반드시 언급.

4. **Trend Analysis:** 과거 수치 변화(상승/하락 추세)를 감지하여 경고.

5. **Contextual:** "왜 이 사람이 이 검사를 걱정하는지" 문진과 연계하여 해석.

**당신의 핵심 역할:**
1. **과거 검진 데이터 분석**: 정상/경계/이상 항목을 명확히 구분하고, 특히 **안 좋았던 항목(이상/경계)**을 중점적으로 파악
2. **문진 데이터와 연관 분석**: 과거에는 정상이었지만 문진 내용(체중 변화, 운동 부족, 가족력, 흡연, 음주 등)상 **추이를 봐야 할 항목** 식별
3. **사용자 선택 항목의 맥락**: 사용자가 직접 선택한 염려 항목의 맥락을 깊이 있게 분석하고, 왜 이 항목을 선택했는지 이해
4. **위험도 계층화**: 위험도 분석 로직을 기반으로 각 장기별 위험도를 명확히 분류 (Low / Moderate / High / Very High Risk)

**분석에 집중하세요:**
- 인터넷 검색은 최소화하고, 주어진 데이터 간의 '논리적 연결'에 집중하세요
- 검진 항목 추천은 하지 마세요 (다음 단계에서 수행됩니다)
- 환자의 건강 상태를 명확히 진단하고, 위험 요인을 식별하는 것에 집중하세요

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요
- 의학 용어는 정확하되, 환자가 이해할 수 있도록 설명을 추가하세요

**응답 규칙:**
- **반드시 딕셔너리(객체) 형태의 JSON 형식으로 응답해야 합니다. 문자열이나 배열이 아닌 JSON 객체 형태로 반환하세요.**
- 다음 필드만 포함하세요:
  * patient_summary: 환자 상태 3줄 요약 (문자열)
  * analysis: 종합 분석 (과거 수치와 현재 생활습관의 연관성 중심, 문자열)
  * risk_profile: 위험도 계층화 결과 (배열) - 각 장기별 위험도 분류
  * chronic_analysis: 만성질환 연쇄 반응 분석 (딕셔너리 객체)
  * survey_reflection: 문진 내용이 검진 설계에 어떻게 반영될지 예고 (문자열)
  * selected_concerns_analysis: 선택한 염려 항목별 분석 (배열)
  * basic_checkup_guide: 기본 검진 가이드 (딕셔너리 객체, focus_items 포함)

**중요: 응답은 반드시 JSON 객체 형태여야 합니다. 예: {{"patient_summary": "...", "analysis": "...", "risk_profile": [...], ...}}**

**검진 항목 추천은 포함하지 마세요. 분석만 수행하세요.**"""

# 시스템 메시지 - STEP 2 (검진 설계 및 세일즈 큐레이터)
CHECKUP_DESIGN_SYSTEM_MESSAGE_STEP2 = f"""당신은 근거 중심 의학(EBM)과 설득 심리학을 갖춘 'AI 헬스 큐레이터'입니다.

**당신의 임무:**

STEP 1의 분석 결과를 바탕으로, 환자가 **"이 검사는 안 받으면 손해다"**라고 느낄 수 있는 빈틈없는 검진 플랜을 설계하세요.

**[지식 베이스 1 - 생애주기 및 만성질환 타겟]**

{PROFILE_GUIDELINE_JSON}

**[지식 베이스 2 - 설득의 기술 (The Bridge Strategy)]**

검사를 제안할 때는 반드시 아래 논리를 사용하세요:

{BRIDGE_STRATEGY_JSON}

**핵심 전략:**

1. **Diagnosis First:** "고객님은 [OO 위험군]이므로"라고 분석 결과를 먼저 제시한 뒤 추천하세요.

2. **Gap Selling:** 기본 검진(무료)의 한계를 명확히 지적하고(Gap), 정밀 검진(유료)의 필요성(Offer)을 연결하세요.

3. **Evidence Based:** 추천 항목에는 반드시 대한민국 공식 학회(대한암학회, 질병관리청 등)나 공신력 있는 근거를 각주로 다세요.

4. **Upselling:** 
   - 50세 이상 당뇨 -> 췌장 CT
   - 고혈압 -> 경동맥 초음파/뇌 MRA
   - 치밀 유방 -> 유방 초음파
   - 흡연자 -> 저선량 폐 CT

5. **Chronic Chain 반영:** 만성질환이 있다면 반드시 합병증 검사를 연쇄적으로 추천하세요 (예: 당뇨 -> 안저검사, 췌장 CT, 신장 기능)

**당신의 핵심 역할:**
1. **STEP 1 분석 결과 활용**: STEP 1에서 지적된 위험 요인을 해결할 수 있는 정밀 검사를 매칭하세요
2. **The Bridge Strategy 구조 사용**: 설득 논리를 만들 때 반드시 4단계 구조(anchor → gap → context → offer)를 사용하세요
3. **의학적 근거 확보**: 모든 추천 항목에는 최신 가이드라인이나 논문 출처(URL)를 각주로 달아주세요
4. **맥락 기반 추천**: 모든 추천은 "STEP 1 분석에서 XX가 확인되었고, 문진에서 YY를 확인했으며, 사용자가 ZZ를 선택했으므로..." 형식으로 맥락을 명확히 설명
5. **만성질환 연쇄 반응**: 만성질환이 있다면 반드시 합병증 검사를 연쇄적으로 추천하세요

**톤앤매너:**
- 전문적이지만 딱딱하지 않게, 환자를 진심으로 걱정하는 신뢰감 있는 어조를 사용하세요
- "비쌉니다" 대신 "미래의 치료비보다 예방이 저렴합니다"라는 뉘앙스를 유지하세요
- "추천합니다" 대신 "완벽한 안심을 위해 필요합니다"라는 표현을 사용하세요
- "필요합니다" 대신 "놓치면 위험할 수 있습니다"라는 표현을 사용하세요

**응답 규칙:**
- **반드시 딕셔너리(객체) 형태의 JSON 형식으로 응답해야 합니다. 문자열이나 배열이 아닌 JSON 객체 형태로 반환하세요.**
- 다음 필드만 포함하세요:
  * strategies: The Bridge Strategy 구조 (배열)
  * recommended_items: 검진 항목 추천 (배열, Evidence, Reference 포함)
  * summary: priority_1, priority_2, priority_3 요약 (딕셔너리 객체)
  * doctor_comment: 의사 코멘트 (문자열)
  * total_count: 전체 추천 항목 수 (숫자)
- 모든 검진 항목은 실제로 존재하는 검진 항목이어야 합니다
- **추천 이유는 구체적이고 명확해야 하며, 의학적 근거를 포함해야 합니다**
- **각 추천 항목에 대해 참고한 의학 자료, 가이드라인, 연구 결과를 명시해야 합니다**

**중요: 응답은 반드시 JSON 객체 형태여야 합니다. 예: {{"strategies": [...], "recommended_items": [...], "summary": {{...}}, ...}}**
- 한국어로 자연스럽고 이해하기 쉽게 작성하세요"""

# 기존 프롬프트 함수 백업 (레거시 버전)
def create_checkup_design_prompt_legacy(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,  # 약품 분석 결과 텍스트 (전체 처방 데이터 대신 사용)
    selected_medication_texts: Optional[List[str]] = None  # 선택된 약품의 사용자 친화적 텍스트
) -> str:
    """
    검진 설계를 위한 GPT 프롬프트 생성 (레거시 버전 - 백업용)
    
    Args:
        patient_name: 환자 이름
        patient_age: 환자 나이
        patient_gender: 환자 성별 (M/F)
        health_data: 최근 3년간 건강검진 데이터
        prescription_data: 약물 복용 이력 데이터
        selected_concerns: 사용자가 선택한 염려 항목 리스트
    
    Returns:
        GPT 프롬프트 문자열
    """
    
    # 현재 날짜 계산 (최근 5년 기준)
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)  # 약 5년 전
    current_date_str = today.strftime("%Y년 %m월 %d일")
    five_years_ago_str = five_years_ago.strftime("%Y년 %m월 %d일")
    
    # 환자 정보 섹션
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 현재 날짜: {current_date_str}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"
    
    # 최근 5년간 검진 이력 섹션 (날짜 기준 필터링)
    health_data_section = f"## 최근 5년간 건강검진 이력 ({five_years_ago_str} ~ {current_date_str})\n\n"
    if health_data and len(health_data) > 0:
        formatted_health_data = []
        recent_count = 0
        old_count = 0
        
        for checkup in health_data[:20]:  # 최대 20개 (최근 5년 데이터 포함)
            # 검진 날짜 파싱 및 비교
            checkup_date_str = checkup.get("checkup_date") or checkup.get("CheckUpDate") or ""
            checkup_year = checkup.get("year") or ""
            
            # 날짜 파싱 시도
            checkup_date_obj = None
            if checkup_date_str:
                try:
                    # 다양한 날짜 형식 시도
                    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y년 %m월 %d일"]:
                        try:
                            checkup_date_obj = datetime.strptime(checkup_date_str, fmt)
                            break
                        except:
                            continue
                except:
                    pass
            
            # 년도로만 비교 (날짜 파싱 실패 시)
            if not checkup_date_obj and checkup_year:
                try:
                    checkup_year_int = int(str(checkup_year).replace('년', '').strip())
                    current_year = today.year
                    if current_year - checkup_year_int > 5:
                        old_count += 1
                        continue  # 5년 이상 오래된 데이터는 제외
                    # 5년 이내면 포함 (recent_count 증가)
                    recent_count += 1
                except:
                    # 년도 파싱 실패 시에도 일단 포함 (데이터 손실 방지)
                    recent_count += 1
            
            # 날짜 객체가 있으면 정확히 비교
            elif checkup_date_obj:
                if checkup_date_obj < five_years_ago:
                    old_count += 1
                    continue  # 5년 이상 오래된 데이터는 제외
                recent_count += 1
            else:
                # 날짜도 년도도 없으면 일단 포함 (데이터 손실 방지)
                recent_count += 1
            checkup_info = {
                "검진일": checkup.get("checkup_date") or checkup.get("CheckUpDate") or "",
                "병원": checkup.get("location") or checkup.get("Location") or "",
                "년도": checkup.get("year") or ""
            }
            
            # 정상/경계/이상 항목 모두 추출 (과거 결과 분석용)
            all_items = []
            normal_items = []
            warning_items = []
            abnormal_items = []
            raw_data = checkup.get("raw_data") or {}
            if raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:  # 최대 5개 검사
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:  # 최대 5개 질환
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:  # 최대 10개 항목
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    
                                    # ItemReferences 확인하여 상태 분류
                                    if item.get("ItemReferences"):
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            item_info = {
                                                "항목명": item_name,
                                                "수치": item_value,
                                                "상태": ref_name
                                            }
                                            
                                            # 정상(A) - 정상
                                            if "정상(A)" in ref_name:
                                                normal_items.append(item_info)
                                                all_items.append({**item_info, "분류": "정상"})
                                                break
                                            # 정상(B) 또는 경계 - 경계
                                            elif "정상(B)" in ref_name or "경계" in ref_name:
                                                warning_items.append(item_info)
                                                all_items.append({**item_info, "분류": "경계"})
                                                break
                                            # 질환의심 또는 이상 - 이상
                                            elif "질환의심" in ref_name or "이상" in ref_name:
                                                abnormal_items.append(item_info)
                                                all_items.append({**item_info, "분류": "이상"})
                                                break
            
            # 정상/경계/이상 항목 모두 포함 (안 좋았던 항목 우선 표시)
            if all_items:
                checkup_info["전체항목"] = {
                    "이상": abnormal_items[:10],  # 이상 항목 우선 (최대 10개)
                    "경계": warning_items[:10],  # 경계 항목 다음 (최대 10개)
                    "정상": normal_items[:5]  # 정상 항목은 최소한만 (최대 5개)
                }
                checkup_info["항목요약"] = f"이상 {len(abnormal_items)}개, 경계 {len(warning_items)}개, 정상 {len(normal_items)}개"
                checkup_info["주의필요"] = f"이상 항목 {len(abnormal_items)}개와 경계 항목 {len(warning_items)}개는 특히 주의 깊게 분석해야 합니다"
                formatted_health_data.append(checkup_info)
        
        if formatted_health_data:
            health_data_section += json.dumps(formatted_health_data, ensure_ascii=False, indent=2)
            health_data_section += f"\n\n**참고:** 최근 5년 내 검진 데이터 {recent_count}건이 포함되었습니다."
            if old_count > 0:
                health_data_section += f" (5년 이상 오래된 데이터 {old_count}건은 제외되었습니다.)"
            health_data_section += "\n\n**가장 중요:** "
            health_data_section += "1) 이상/경계 항목(안 좋았던 것들)을 중점적으로 분석하세요. "
            health_data_section += "2) 정상 항목 중에서도 문진 내용상 추이를 봐야 할 항목을 식별하세요. "
            health_data_section += "3) 모든 분석은 맥락을 명확히 하세요 (과거 결과 + 문진 + 선택 항목의 연관성)."
        else:
            if old_count > 0:
                health_data_section += f"최근 5년 내 검진 이력이 확인되지 않습니다. (5년 이상 오래된 데이터 {old_count}건은 제외되었습니다.)\n"
                health_data_section += f"\n**⚠️ 중요:** 오래된 검진 데이터만 있는 경우, 반드시 다음 내용을 포함한 코멘트를 추가하세요:\n"
                health_data_section += f"1. '가장 최근 검진이 5년 이상 전이므로, 현재 건강 상태를 정확히 파악하기 어렵습니다.'\n"
                health_data_section += f"2. '최근 건강 상태 변화를 확인하기 위해 새로운 검진이 필요합니다.'\n"
                health_data_section += f"3. '나이, 생활습관 변화, 가족력 등을 고려하여 종합적인 검진을 권장합니다.'\n"
            else:
                health_data_section += "검진 이력이 확인되지 않습니다.\n"
            health_data_section += "\n\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '검진을 하지 않아서' 같은 판단을 하지 마세요. "
            health_data_section += "우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다. "
            health_data_section += "정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아' "
            health_data_section += "절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서' "
            health_data_section += "데이터 부재는 '확인 불가' 또는 '확인되지 않음'으로만 표현하고, 추측이나 가정을 하지 마세요.\n"
    else:
        health_data_section += "검진 이력이 확인되지 않습니다.\n"
        health_data_section += "\n\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '검진을 하지 않아서' 같은 판단을 하지 마세요. "
        health_data_section += "우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다. "
        health_data_section += "정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아' "
        health_data_section += "절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서' "
        health_data_section += "데이터 부재는 '확인 불가' 또는 '확인되지 않음'으로만 표현하고, 추측이나 가정을 하지 마세요.\n"
    
    # 약물 복용 이력 섹션
    prescription_section = "## 약물 복용 이력\n\n"
    
    # 분석 결과 텍스트가 있으면 우선 사용 (전체 처방 데이터 대신)
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section += clean_analysis_text
        prescription_section += "\n\n**중요:** 위 분석 결과는 처방 이력을 효능별로 분석한 결과입니다. 각 약품의 복용 패턴(지속적/주기적/간헐적), 복용 기간, 처방 횟수 등을 종합적으로 고려하여 검진 항목을 추천하세요."
    elif prescription_data and len(prescription_data) > 0:
        # 하위 호환성: 분석 결과 텍스트가 없으면 기존 방식 사용
        formatted_prescriptions = []
        for prescription in prescription_data[:10]:  # 최대 10개만
            raw_data = prescription.get("raw_data") or {}
            medications = []
            
            if raw_data.get("Items"):
                for item in raw_data["Items"][:5]:  # 최대 5개 약물만
                    drug_name = item.get("DrugName") or item.get("MedicationName") or ""
                    start_date = item.get("StartDate") or ""
                    end_date = item.get("EndDate") or ""
                    
                    if drug_name:
                        medications.append({
                            "약물명": drug_name,
                            "복용기간": f"{start_date} ~ {end_date if end_date else '현재'}"
                        })
            
            if medications:
                formatted_prescriptions.append({
                    "처방일": prescription.get("PrescriptionDate") or prescription.get("prescription_date") or "",
                    "병원": raw_data.get("Location") or prescription.get("location") or "",
                    "약물": medications
                })
        
        if formatted_prescriptions:
            prescription_section += json.dumps(formatted_prescriptions, ensure_ascii=False, indent=2)
        else:
            prescription_section += "약물 복용 이력이 없습니다.\n"
    else:
        prescription_section += "약물 복용 이력이 없습니다.\n"
    
    # 선택한 염려 항목 섹션 (가장 중요!)
    concerns_section = "## 사용자가 선택한 염려 항목\n\n"
    if selected_concerns and len(selected_concerns) > 0:
        formatted_concerns = []
        for concern in selected_concerns:
            concern_type = concern.get("type") or ""
            if concern_type == "checkup":
                formatted_concerns.append({
                    "유형": "검진 항목",
                    "항목명": concern.get("name") or concern.get("item_name") or "",
                    "검진일": concern.get("date") or concern.get("checkup_date") or "",
                    "수치": f"{concern.get('value') or ''} {concern.get('unit') or ''}",
                    "상태": "경계" if concern.get("status") == "warning" else "이상",
                    "병원": concern.get("location") or ""
                })
            elif concern_type == "hospital":
                formatted_concerns.append({
                    "유형": "병원",
                    "병원명": concern.get("hospitalName") or concern.get("hospital_name") or "",
                    "검진일": concern.get("checkupDate") or concern.get("checkup_date") or "",
                    "이상항목수": concern.get("abnormalCount") or 0,
                    "경계항목수": concern.get("warningCount") or 0
                })
            elif concern_type == "medication":
                concern_item = {
                    "유형": "약물",
                    "약물명": concern.get("medicationName") or concern.get("medication_name") or "",
                    "복용기간": concern.get("period") or "",
                    "병원": concern.get("hospitalName") or concern.get("hospital_name") or ""
                }
                # 사용자 친화적 텍스트가 있으면 추가 (HTML 태그 제거)
                if concern.get("medicationText"):
                    clean_medication_text = remove_html_tags(concern.get("medicationText"))
                    concern_item["복용 패턴 설명"] = clean_medication_text
                formatted_concerns.append(concern_item)
        
        concerns_section += json.dumps(formatted_concerns, ensure_ascii=False, indent=2)
        
        # 선택된 약품 텍스트가 있으면 추가 (HTML 태그 제거)
        if selected_medication_texts and len(selected_medication_texts) > 0:
            concerns_section += "\n\n**고민되는 처방 이력 (사용자가 선택한 항목):**\n"
            for i, text in enumerate(selected_medication_texts, 1):
                clean_text = remove_html_tags(text)
                concerns_section += f"\n{i}. {clean_text}"
        
        concerns_section += "\n\n**중요:** 위 염려 항목들은 사용자가 직접 선택한 항목입니다. 이 항목들과 관련된 정밀 검진을 우선적으로 추천해야 합니다."
        concerns_section += "\n\n**특별 요청:** 각 선택한 항목에 대해 최근 5년간의 추이를 분석하고, 해당 항목과 관련된 검진을 별도 섹션으로 구성하여 상세히 설명해주세요."
    else:
        concerns_section += "선택한 염려 항목이 없습니다.\n"
    
    # 설문 응답 섹션
    survey_section = "## 추가 설문 응답\n\n"
    if survey_responses and len(survey_responses) > 0:
        survey_data = {}
        
        # 체중 변화
        weight_change_map = {
            "increase_more": "증가 (3kg 이상)",
            "increase_some": "약간 증가 (1-3kg)",
            "maintain": "유지",
            "decrease_some": "약간 감소 (1-3kg)",
            "decrease_more": "감소 (3kg 이상)"
        }
        if survey_responses.get("weight_change"):
            survey_data["최근 체중 변화"] = weight_change_map.get(survey_responses["weight_change"], survey_responses["weight_change"])
        
        # 운동 빈도
        exercise_map = {
            "regular": "규칙적으로 운동함 (주 3회 이상)",
            "sometimes": "가끔 운동함 (주 1-2회)",
            "rarely": "거의 안 함",
            "never": "전혀 안 함"
        }
        if survey_responses.get("exercise_frequency"):
            survey_data["운동 빈도"] = exercise_map.get(survey_responses["exercise_frequency"], survey_responses["exercise_frequency"])
        
        # 가족력
        family_history_map = {
            "hypertension": "고혈압",
            "diabetes": "당뇨병",
            "heart_disease": "심장질환",
            "cancer": "암",
            "stroke": "뇌졸중",
            "none": "없음"
        }
        if survey_responses.get("family_history"):
            family_history_list = survey_responses["family_history"]
            if isinstance(family_history_list, list):
                survey_data["가족력"] = [family_history_map.get(fh, fh) for fh in family_history_list if fh != "none"]
                if "none" in family_history_list:
                    survey_data["가족력"] = ["없음"]
        
        # 흡연
        smoking_map = {
            "non_smoker": "비흡연",
            "ex_smoker": "과거 흡연 (금연)",
            "current_smoker": "현재 흡연"
        }
        if survey_responses.get("smoking"):
            survey_data["흡연"] = smoking_map.get(survey_responses["smoking"], survey_responses["smoking"])
        
        # 음주
        drinking_map = {
            "never": "전혀 안 함",
            "monthly_less": "월 1회 미만",
            "monthly_1_2": "월 1-2회",
            "weekly_1_2": "주 1-2회",
            "weekly_3plus": "주 3회 이상"
        }
        if survey_responses.get("drinking"):
            survey_data["음주 빈도"] = drinking_map.get(survey_responses["drinking"], survey_responses["drinking"])
        
        # 수면 시간
        sleep_map = {
            "less_5": "5시간 미만",
            "5_6": "5-6시간",
            "6_7": "6-7시간",
            "7_8": "7-8시간",
            "more_8": "8시간 이상"
        }
        if survey_responses.get("sleep_hours"):
            survey_data["수면 시간"] = sleep_map.get(survey_responses["sleep_hours"], survey_responses["sleep_hours"])
        
        # 스트레스 수준
        stress_map = {
            "very_high": "매우 높음",
            "high": "높음",
            "medium": "보통",
            "low": "낮음",
            "very_low": "매우 낮음"
        }
        if survey_responses.get("stress_level"):
            survey_data["스트레스 수준"] = stress_map.get(survey_responses["stress_level"], survey_responses["stress_level"])
        
        # 추가 고민사항
        if survey_responses.get("additional_concerns"):
            survey_data["추가 고민사항"] = survey_responses["additional_concerns"]
        
        # 선택적 추가 질문 (optional_questions_enabled가 'yes'인 경우에만)
        if survey_responses.get("optional_questions_enabled") == "yes":
            optional_questions_data = {}
            
            if survey_responses.get("cancer_history"):
                cancer_map = {
                    "yes_current": "예, 현재 치료 중",
                    "yes_past": "예, 과거에 치료를 받았음",
                    "no": "아니오"
                }
                optional_questions_data["암 진단 이력"] = cancer_map.get(
                    survey_responses["cancer_history"], 
                    survey_responses["cancer_history"]
                )
            
            if survey_responses.get("hepatitis_carrier"):
                hepatitis_map = {
                    "hepatitis_b": "B형 간염 보균자",
                    "hepatitis_c": "C형 간염 보균자",
                    "both": "B형/C형 간염 보균자 둘 다",
                    "no": "아니오"
                }
                optional_questions_data["간염 보균자"] = hepatitis_map.get(
                    survey_responses["hepatitis_carrier"],
                    survey_responses["hepatitis_carrier"]
                )
            
            if survey_responses.get("colonoscopy_experience"):
                colonoscopy_map = {
                    "yes_comfortable": "예, 불편함 없이 받았음",
                    "yes_uncomfortable": "예, 불편했음",
                    "no_afraid": "아니오, 두려워서 받지 않음",
                    "no_never": "아니오, 받아본 적 없음"
                }
                optional_questions_data["대장내시경 경험"] = colonoscopy_map.get(
                    survey_responses["colonoscopy_experience"],
                    survey_responses["colonoscopy_experience"]
                )
            
            if survey_responses.get("lung_nodule"):
                lung_nodule_map = {
                    "yes": "예",
                    "no": "아니오",
                    "unknown": "모르겠음"
                }
                optional_questions_data["폐 결절 이력"] = lung_nodule_map.get(
                    survey_responses["lung_nodule"],
                    survey_responses["lung_nodule"]
                )
            
            if survey_responses.get("gastritis"):
                gastritis_map = {
                    "yes_current": "예, 현재 있음",
                    "yes_past": "예, 과거에 있었음",
                    "no": "아니오"
                }
                optional_questions_data["위염/소화불량"] = gastritis_map.get(
                    survey_responses["gastritis"],
                    survey_responses["gastritis"]
                )
            
            if survey_responses.get("imaging_aversion"):
                imaging_aversion = survey_responses["imaging_aversion"]
                if isinstance(imaging_aversion, list):
                    imaging_map = {
                        "ct": "CT (컴퓨터 단층촬영)",
                        "xray": "X-ray (엑스레이)",
                        "mri": "MRI (자기공명영상)",
                        "none": "없음"
                    }
                    optional_questions_data["영상 검사 기피"] = [
                        imaging_map.get(item, item) for item in imaging_aversion if item != "none"
                    ] if "none" not in imaging_aversion else ["없음"]
                else:
                    optional_questions_data["영상 검사 기피"] = imaging_aversion
            
            if survey_responses.get("genetic_test"):
                genetic_map = {
                    "yes": "예",
                    "no": "아니오",
                    "unknown": "모르겠음"
                }
                optional_questions_data["유전성 암 의심"] = genetic_map.get(
                    survey_responses["genetic_test"],
                    survey_responses["genetic_test"]
                )
            
            if optional_questions_data:
                survey_data["선택적 추가 질문"] = optional_questions_data
        
        if survey_data:
            survey_section += json.dumps(survey_data, ensure_ascii=False, indent=2)
            survey_section += "\n\n**가장 중요:** 위 설문 응답은 환자의 최근 생활 패턴과 건강 상태를 나타냅니다. "
            survey_section += "이 정보를 바탕으로 **과거에는 정상이었지만 문진 내용상 추이를 봐야 할 항목**을 식별하세요. "
            survey_section += "예: 체중 증가 + 운동 부족 → 대사증후군 관련 검사, 가족력 → 해당 질환 관련 검사, 흡연 → 폐/심혈관 검사 등"
            
            # 선택적 질문이 있는 경우 추가 설명
            if survey_data.get("선택적 추가 질문"):
                survey_section += "\n\n**선택적 추가 질문 응답:** 환자가 추가 질문에 답변한 경우, 이 정보를 활용하여 "
                survey_section += "더 정확한 프리미엄 항목 추천을 할 수 있습니다. 예: 암 진단 이력 → 암 정밀 검사, "
                survey_section += "간염 보균자 → 간암 검사, 대장내시경 기피 → 대장암 혈액 검사 등"
        else:
            survey_section += "설문 응답이 없습니다.\n"
    else:
        survey_section += "설문 응답이 없습니다.\n"
    
    # 병원별 검진 항목 섹션 (카테고리별 분류 적용)
    hospital_checkup_section = format_hospital_checkup_items_for_prompt(
        hospital_national_checkup,
        hospital_recommended,
        hospital_external_checkup
    )
    
    # 성별 필터링 강화 (추가 설명)
    if patient_gender and (hospital_recommended or hospital_external_checkup):
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        hospital_checkup_section += f"\n**성별 필터링 필수:** 환자는 **{gender_text}**입니다. "
        if patient_gender.upper() == "M":
            hospital_checkup_section += "**남성 환자이므로 여성 전용 검진 항목(유방 초음파, 자궁경부암 검진, 골밀도 검사 등)은 절대 추천하지 마세요.** "
        else:
            hospital_checkup_section += "**여성 환자이므로 여성 전용 검진 항목만 추천하세요.** "
        hospital_checkup_section += "각 검진 항목의 gender 필드를 확인하여 환자 성별과 일치하는 항목만 추천하세요.\n\n"
    
    # 일반검진 항목 표현 규칙 추가
    if hospital_national_checkup:
        hospital_checkup_section += "**일반검진 항목 표현 규칙:** 일반검진 항목은 의무검진이므로 결과지를 확인하실 때, "
        hospital_checkup_section += "과거 결과(특히 안 좋았던 항목)와 문진 내용, 선택한 항목의 맥락과 매칭되면 "
        hospital_checkup_section += "**'이 이유 때문에 잘 살펴보세요'**라는 친근한 관점으로 소개하세요. "
        hospital_checkup_section += "형식: '일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 이 부분은 특히 눈여겨보시면 좋겠어요.' "
        hospital_checkup_section += "절대 '추천 항목', '기본검진 외에 이것도 더 자세히 보는 것이 좋을 것 같습니다', '꼭 체크하셔야 합니다' 같은 딱딱한 표현을 사용하지 마세요. "
        hospital_checkup_section += "친근하고 자연스러운 표현을 사용하세요: '잘 보시길 바랍니다', '눈여겨보세요', '이 부분은 잘 봐주세요', '이유를 알려드리니' "
        hospital_checkup_section += "**이 일반검진 항목은 summary.priority_1에만 포함되며, priority_2나 priority_3에는 포함하지 않습니다.**\n"
        hospital_checkup_section += "이 맥락을 basic_checkup_guide.focus_items와 summary.priority_1.national_checkup_note에 명확히 작성하세요.\n\n"
    
    # 병원 추천 항목 추가 설명
    if hospital_recommended:
        hospital_checkup_section += "**병원 추천 항목 활용 가이드:** 병원 추천 항목은 **반드시 priority_2에 포함**하되, "
        hospital_checkup_section += "**맥락이 명확한 항목을 우선 추천**하세요: "
        hospital_checkup_section += "과거 이력(안 좋았던 항목) + 문진(추이를 봐야 할 항목) + 선택 항목의 맥락 + 나이별 권장 검진이 모두 매칭되는 항목을 추천하면 업셀링 효과가 높습니다. "
        hospital_checkup_section += "**이 항목들은 priority_1에 포함하지 않습니다.**\n\n"
    
    # 외부 검사 항목 추가 설명 (format_hospital_checkup_items_for_prompt에서 이미 처리됨)
    if hospital_external_checkup:
        hospital_checkup_section += "**외부 검사 항목 활용 가이드:**\n"
        hospital_checkup_section += "1. **algorithm_class 우선 고려**: 알고리즘 분류를 기준으로 추천 우선순위 결정\n"
        hospital_checkup_section += "   - 1. 현재 암 유무 확인(Screening): 일반적인 암 선별 검사, priority_2에 우선 추천\n"
        hospital_checkup_section += "   - 2. 유증상자 진단(Diagnosis Aid): 증상이 있는 경우, priority_2에 추천\n"
        hospital_checkup_section += "   - 3. 암 위험도 예측(Risk Prediction): 가족력이나 위험 요인이 있는 경우, priority_2 또는 priority_3에 추천\n"
        hospital_checkup_section += "   - 4. 감염 및 원인 확인(Prevention): 감염 질환 예방, priority_3에 추천\n"
        hospital_checkup_section += "   - 5. 치료용 정밀진단(Tx Selection): 치료 중인 경우, priority_3에 추천\n"
        hospital_checkup_section += "2. **target_trigger 매칭**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger가 매칭되는 항목을 우선 추천\n"
        hospital_checkup_section += "3. **target 필드 활용**: 환자의 걱정 항목과 target 필드가 일치하는 항목을 우선 추천 (예: 대장암 걱정 → target이 '대장암'인 항목)\n"
        hospital_checkup_section += "4. **difficulty_level 고려**: Low는 priority_3에, Mid는 priority_2에, High는 priority_2 또는 priority_3에 고려 (환자 상황에 따라)\n"
        hospital_checkup_section += "5. **The Bridge Strategy 적용**: gap_description을 활용하여 기본 검진의 한계를 설명하고, solution_narrative를 활용하여 자연스럽게 업셀링\n"
        hospital_checkup_section += "6. **category/sub_category 활용**: 환자의 건강 상태와 관련된 카테고리 항목을 우선 추천 (예: 심혈관 걱정 → 심혈관 카테고리)\n\n"
        hospital_checkup_section += "**⚠️ 외부 검사 항목 설명 시 필수 지침:**\n"
        hospital_checkup_section += "1. **'키트' 단어 사용 금지**: 아이캔서치(ai-CANCERCH), 캔서파인드, 마스토체크(MASTOCHECK) 등 혈액 기반 검사는 절대 '키트'라고 표현하지 마세요.\n"
        hospital_checkup_section += "   - ✅ 올바른 표현: '검사(Test)', '선별 검사(Screening)', '혈액 검사'\n"
        hospital_checkup_section += "   - ❌ 금지 표현: '키트', '검사 키트', '키트 검사'\n"
        hospital_checkup_section += "2. **예외 사항**: 대장암 분변 검사(얼리텍 대장암 검사 등)처럼 박스 형태로 제공되는 경우에만 예외적으로 '키트 형태'라고 묘사할 수 있습니다.\n"
        hospital_checkup_section += "3. **확진 vs 위험도 예측 구분**: 이 검사들은 **'확진(Diagnosis)'**이 아니라 **'위험도 예측(Risk Assessment)'** 또는 **'선별 검사(Screening)'**임을 명확히 설명하세요.\n"
        hospital_checkup_section += "   - ✅ 올바른 표현: '암 위험도를 평가하는 선별 검사', '위험도 예측 검사', '조기 발견을 위한 선별 검사'\n"
        hospital_checkup_section += "   - ❌ 금지 표현: '암을 확진하는 검사', '진단 검사', '확진 키트'\n"
        hospital_checkup_section += "4. **검사 성격 명시**: 검사 설명 시 '이 검사는 확진을 위한 것이 아니라, 위험도를 평가하고 조기 발견을 위한 선별 검사입니다'라는 맥락을 포함하세요.\n\n"
    
    # Master DB 섹션 추가
    master_knowledge_section = build_master_knowledge_section()
    
    # 최종 프롬프트 조합
    prompt = f"""{master_knowledge_section}

{patient_info}

{health_data_section}

{prescription_section}

{concerns_section}

{survey_section}

{hospital_checkup_section}

---

## 요청사항

위 정보를 종합적으로 분석하여 다음 JSON 형식으로 검진 계획을 제안해주세요:

**patient_summary 작성 규칙:**
- 환자의 건강 상태와 주요 리스크를 3줄로 요약 (스토리텔링 도입부)
- **절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '최근 5년간 건강검진에서 이상이나 경계 소견은 없으나', '검진을 하지 않아서' 같은 판단을 하지 마세요
- 우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다
- **정확한 표현 사용:**
  * '검진 내용이 확인되지 않았다'
  * '검진 데이터가 제공되지 않아'
  * '검진 이력이 확인되지 않아'
  * '최근 검진 데이터가 확인되지 않아'
- **절대 사용하지 말 것:**
  * '검진이 없었다'
  * '검진을 하지 않아서'
  * '검진을 받지 않아서'
  * '5년간 이상소견이 없었다' (데이터가 없을 뿐, 실제로는 있었을 수 있음)
- 데이터 부재는 '확인 불가' 또는 '확인되지 않음'으로만 언급하고, 추측이나 가정을 하지 마세요
- 실제 데이터에 기반한 사실만 기술하세요 (예: "과거 검진에서 혈압이 140/90으로 측정되었고", "문진에서 높은 스트레스 수준을 확인했으며")

```json
{{
  "patient_summary": "환자의 건강 상태와 주요 리스크를 3줄로 요약 (스토리텔링 도입부). **데이터가 없으면 추측하지 말고 '확인 불가'로만 표현**",
  
  "basic_checkup_guide": {{
    "title": "일반검진, 이 부분은 잘 보세요",
    "description": "일반검진 결과지를 확인하실 때, {{patient_name}}님의 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다.",
    "focus_items": [
      {{
        "item_name": "공복혈당 (Diabetes)",
        "why_important": "3년 전부터 수치가 95-99 사이로, 당뇨 전단계 경계선에 있어서요.",
        "check_point": "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요."
      }}
    ]
  }},
  
  "selected_concerns_analysis": [
    {{
      "concern_name": "선택한 항목명 (예: 혈압, 혈당, 특정 약물 등)",
      "concern_type": "checkup|medication|hospital",
      "trend_analysis": "최근 5년간의 추이 분석 (수치 변화, 패턴, 위험도 등)",
      "reflected_in_design": "이 항목을 검진 설계에 어떻게 반영했는지 구체적으로 설명",
      "related_items": ["이 항목과 관련된 추천 검진 항목 ID 리스트"]
    }}
  ],
  "summary": {{
    "past_results_summary": "과거 검진 결과 요약 (정상/경계/이상 항목 중심으로)",
    "survey_summary": "문진 내용 요약 (체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)",
    "correlation_analysis": "과거 결과와 문진 내용의 연관성 분석 및 주의사항",
    
    **중요 규칙 (priority_1) - 매우 중요:**
    - priority_1.items의 모든 항목은 반드시 hospital_national_checkup의 **'items' 배열**에 있는 구체적인 항목명이어야 합니다
    - **절대 사용하지 말 것**: 일반적인 카테고리명 (예: '소화기계 검사', '심혈관 건강 검사', '위장 건강', '심혈관 건강')
    - **반드시 사용할 것**: DB의 'items' 배열에 있는 구체적인 항목명 (예: '혈압측정', '체질량지수', '신체계측', '혈액검사', '소변검사', '흉부X선', '시력검사', '청력검사')
    - **카테고리 구분 필수**: priority_1에는 hospital_national_checkup의 'category' 필드가 '일반' 또는 '기본검진'인 항목의 'items' 배열만 사용하세요
    - '종합' 또는 '옵션' 카테고리는 priority_1에 포함하지 마세요 (종합은 priority_2, 옵션은 priority_3에 포함)
    - priority_1.items와 priority_1.national_checkup_items는 동일한 항목이어야 합니다
    - priority_1.items에 hospital_recommended나 hospital_external_checkup의 항목을 포함하지 마세요
    - 추가 검진 항목(심전도, 24시간 홀터 심전도 등)은 priority_2나 priority_3에 포함하세요
    - **개수 제한**: **priority_1.items는 최소 1개 이상, 최대 3개까지 추천하세요.** 가장 중요하고 주의 깊게 봐야 할 항목을 선정하세요.
    - **예시**: 환자가 소화기계 관련 걱정이 있어도 '소화기계 검사'가 아닌 '혈액검사', '소변검사' 같은 구체적인 항목명을 사용하세요
    
    **성별 필터링 규칙 (모든 priority에 적용):**
    - 환자 성별: {gender_text if patient_gender else "확인 불가"}
    - **남성 환자인 경우**: 여성 전용 검진 항목(유방 초음파, 자궁경부암 검진, 골밀도 검사 등)은 절대 추천하지 마세요
    - **여성 환자인 경우**: 여성 전용 검진 항목만 추천하세요
    - 각 검진 항목의 gender 필드("M", "F", "all")를 확인하여 환자 성별과 일치하는 항목만 추천하세요
    - hospital_recommended 항목 중 gender 필드가 "F"인 항목은 남성 환자에게 추천하지 마세요
    
    "priority_1": {{
      "title": "1순위: 관리하실 항목이에요",
      "description": "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다.",
      "items": ["기본 검진 항목명 1", "기본 검진 항목명 2"],  // 반드시 national_checkup_items에 포함된 항목만, 최소 1개 이상 최대 3개
      "count": 항목 개수 (최소 1개 이상, 최대 3개),
      "national_checkup_items": ["일반검진 항목명 1", "일반검진 항목명 2"],  // items와 동일한 항목들 (기본 검진 항목만)
      "national_checkup_note": "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 맥락: [구체적인 이유를 친근하게 설명]",
      "focus_items": [  // 각 항목별 상세 정보 (basic_checkup_guide.focus_items와 동일한 형식)
        {{
          "item_name": "기본 검진 항목명 1",
          "why_important": "이 항목이 왜 중요한지 구체적으로 설명 (과거 검진 결과, 문진 내용, 선택 항목 맥락을 종합하여 친근하게 설명)",
          "check_point": "확인할 때 주의할 포인트 (친근한 톤으로, 예: '올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.')"
        }}
      ]
    }},
    "priority_2": {{
      "title": "2순위: 병원 추천 검진 항목",
      "description": "나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 매칭되는 항목을 맥락과 함께 추천합니다.",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "upselling_focus": true,
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강', '심혈관 및 복부 장기 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }},
    "priority_3": {{
      "title": "3순위: 선택 검진 항목",
      "description": "선택적으로 받을 수 있는 검진 항목 (예방 차원, 추가 확인)",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }}
  }},
  "strategies": [
    {{
      "strategy_title": "매력적인 전략 제목 (예: 침묵의 장기, 췌장까지 완벽하게)",
      "related_concern": "환자가 선택한 염려 항목 or 문진 증상",
      "priority": 1,
      "bridging_narrative": {{
        "step1_anchor": "올해 대상이신 일반검진의 [항목명]으로 [확인 가능한 내용]을 보는 것은 매우 중요합니다.",
        "step2_gap": "하지만 [항목명]은 [구체적 한계]만 보여줄 뿐, [확인 불가능한 내용]은 알 수 없는 '반쪽짜리 확인'입니다.",
        "step3_patient_context": "특히 환자분의 [구체적 증상/가족력/이력]을 고려할 때, 이 부분을 놓치면 [구체적 위험]이 있습니다.",
        "step4_offer": "따라서 [정밀검진명]을 더해 '[확인 가능한 내용]'과 '[추가 확인 내용]'을 동시에 확인해야 완벽한 안심이 가능합니다."
      }},
      "recommended_item": {{
        "name": "복부 조영 CT",
        "category": "소화기 정밀",
        "is_upselling": true,
        "reason_summary": "초음파로 보기 힘든 췌장/담낭의 미세 병변 확인",
        "hospital_advantage": "본 병원의 128채널 CT로 1mm 크기의 병변도 찾아낼 수 있습니다."
      }}
    }}
  ],
  
  "recommended_items": [
    {{
      "category": "카테고리명 (예: 대장검사, CT검사, MRI검사 등)",
      "category_en": "영문 카테고리명",
      "itemCount": 카테고리별 항목 개수,
      "priority_level": 1 또는 2 또는 3,
      "priority_description": "이 카테고리가 해당 우선순위인 이유 설명",
      "items": [
        {{
          "name": "검진 항목명 (한글)",
          "nameEn": "검진 항목명 (영문)",
          "description": "검진에 대한 간단한 설명 (환자가 이해하기 쉽게)",
          "reason": "이 검진을 추천하는 구체적인 이유 - 맥락을 명확히 설명하세요. "
          "**일반검진 항목인 경우**: '일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. 과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요.' "
          "**일반검진이 아닌 경우**: '과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다. [나이별 권장 검진과도 매칭됩니다].' "
          "각주 형식으로 참고 자료를 표시하세요",
          "evidence": "의학적 근거 및 참고 자료. **작은 텍스트 형식(각주)**으로 다음을 포함하세요: "
          "1) 가이드라인 (예: '※ 2025 당뇨병 진료지침'), "
          "2) 사례 (예: '※ 유사한 임상 사례에서 효과 확인'), "
          "3) 실험/연구 (예: '※ 최신 연구 결과[1]'), "
          "4) 에비던스 레벨 (예: '※ Level A 에비던스, 강한 근거'). "
          "형식: '※ [가이드라인명], [에비던스 레벨], [연구 인용]' (작게 표시)",
          "references": ["신뢰할 수 있는 의학 자료 출처만 사용하세요. **한국 자료를 최우선으로 사용하고, 한국 자료가 없을 때만 PubMed를 사용하세요.** 반드시 다음 목록에서만 참조: PubMed (pubmed.ncbi.nlm.nih.gov - 한국 자료 없을 때만), 대한의학회 (kma.org), 질병관리청 (kdca.go.kr), 대한심장학회 (circulation.or.kr), 대한당뇨학회 (diabetes.or.kr), 대한고혈압학회 (koreanhypertension.org), 대한암학회 (cancer.or.kr), 대한소화기학회 (gastro.or.kr), 대한내분비학회 (endocrinology.or.kr). 예: https://www.kma.org/... 또는 https://pubmed.ncbi.nlm.nih.gov/12345678 (한국 자료 없을 때만)"],
          "priority": 우선순위 (1-3, 1이 가장 높음),
          "recommended": true,
          "related_to_selected_concern": "선택한 염려 항목과의 연관성 (있는 경우)"
        }}
      ],
      "doctor_recommendation": {{
        "has_recommendation": true/false,
        "message": "의사 추천 메시지 (환자의 실제 데이터를 기반으로 구체적으로 작성)",
        "highlighted_text": "강조할 텍스트 (메시지 내에서)"
      }},
      "defaultExpanded": true/false
    }}
  ],
  "analysis": "주치의 관점에서 환자의 건강 상태를 종합적으로 분석 (2-3문단). 과거 검진 결과(정상/경계/이상 항목)와 문진 내용(체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)을 연관 지어 설명하세요. 중요한 문장이나 핵심 내용은 {{highlight}}텍스트{{/highlight}} 형식으로 감싸서 강조하세요. 예: '과거 검진에서는 정상 범위였지만, {{highlight}}문진에서 확인한 체중 증가와 운동 부족은 대사증후군 위험을 높일 수 있습니다{{/highlight}}...'",
  "survey_reflection": "문진 내용을 종합 분석하여 검진 설계에 어떻게 반영했는지 구체적으로 설명. 과거 결과와의 연관성을 명시하세요 (예: '과거 검진에서 정상이었던 혈압이지만, 문진에서 확인한 체중 증가와 운동 부족을 고려하여...', '가족력에 고혈압이 있어 과거 정상 수치라도 주의 깊게 모니터링이 필요합니다...')",
  "doctor_comment": "마무리 인사 및 검진 독려 메시지",
  "total_count": 전체 추천 검진 항목 개수
}}
```

**작성 순서 및 규칙 (단계별로 명확히 따라주세요):**

## STEP 1: 데이터 분석 (먼저 수행)

**중요: 데이터 부재 시 판단 금지**
- 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '검진을 하지 않아서' 같은 판단을 절대 하지 마세요
- 정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아'
- 절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서'
- 데이터가 없을 뿐, 실제로는 이상소견이나 경계 소견이 있었을 수 있습니다
- 데이터 부재는 '확인 불가'로만 표현하고, 추측이나 가정을 하지 마세요

### 1-1. 과거 검진 데이터 분석
- **우선순위**: 이상(질환의심) > 경계(정상(B)) > 정상
- **분석 방법**: 최근 5년간 추이 분석 (수치 변화, 패턴, 위험도)
- **예시**: "과거 검진에서 혈압이 경계 범위였고, 최근 3년간 점진적으로 상승 추세입니다 (120/80 → 135/85 → 140/90)"

### 1-2. 문진 데이터 분석
- **분석 대상**: 체중 변화, 운동 빈도, 가족력, 흡연, 음주, 수면, 스트레스
- **식별 목표**: 과거에는 정상이었지만 문진 내용상 주의가 필요한 항목
- **예시**: "과거 검진에서는 정상 범위였지만, 문진에서 확인한 체중 증가(3kg 이상)와 운동 부족은 대사증후군 위험을 높일 수 있어 혈당, 콜레스테롤 추이를 주의 깊게 봐야 합니다"

### 1-3. 선택한 항목 맥락 분석
- **분석 방법**: "왜 이 항목을 선택했는지" 맥락 추론
- **연결**: 선택 항목 + 과거 검진 + 문진 내용 통합 분석
- **예시**: "사용자가 혈압을 선택한 맥락: 과거 검진에서 경계 범위였고, 최근 두통이 자주 발생하며, 가족력에 고혈압이 있어 우려하고 있습니다"

## STEP 2: 일반검진 가이드 작성 (basic_checkup_guide) - 선택적

**중요: basic_checkup_guide는 선택적으로 생성할 수 있습니다. priority_1.focus_items가 우선되며, 두 곳에 동일한 정보를 중복 생성하지 마세요.**

### 2-1. 작성 규칙 (선택적)
- **제목**: "일반검진, 이 부분은 잘 보세요" (친근하고 직접적인 표현)
- **설명**: "일반검진 결과지를 확인하실 때, {{patient_name}}님의 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다."
- **표현 금지**: "추천 항목", "기본검진 외에 이것도 더 자세히 보는 것이 좋을 것 같습니다", "꼭 체크하셔야 합니다" (딱딱한 표현)
- **친근한 표현 사용**: "잘 보시길 바랍니다", "눈여겨보세요", "이 부분은 잘 봐주세요", "이유를 알려드리니"
- **우선순위**: priority_1.focus_items에 동일한 정보를 작성하는 것이 우선입니다. basic_checkup_guide는 하위 호환성을 위해 선택적으로 생성할 수 있습니다.

### 2-2. focus_items 작성 형식 (참고용 - priority_1.focus_items와 동일)
```json
{{
  "item_name": "공복혈당 (Diabetes)",
  "why_important": "3년 전부터 수치가 95-99 사이로, 당뇨 전단계 경계선에 있어서요. (이유를 친근하게 설명)",
  "check_point": "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요. (친근한 톤으로)"
}}
```

## STEP 3: The Bridge Strategy 적용 (strategies 배열)

### 3-1. strategy 작성 순서
각 strategy는 반드시 다음 4단계 구조로 작성:

**step1_anchor (기본 검진 가치 인정)**
- 형식: "올해 대상이신 일반검진의 [항목명]으로 [확인 가능한 내용]을 보는 것은 매우 중요합니다."
- 예시: "올해 대상이신 일반검진 혈액검사로 간 수치(AST/ALT) 흐름을 보는 것은 매우 중요합니다."

**step2_gap (의학적 한계 노출)**
- 형식: "하지만 [항목명]은 [구체적 한계]만 보여줄 뿐, [확인 불가능한 내용]은 알 수 없는 '반쪽짜리 확인'입니다."
- 예시: "하지만 혈액검사는 간 세포가 파괴된 결과만 보여줄 뿐, 실제 간의 모양이나 종양 유무는 알 수 없는 '반쪽짜리 확인'입니다."

**step3_patient_context (환자 맞춤 위험 설명)**
- 형식: "특히 환자분의 [구체적 증상/가족력/이력]을 고려할 때, 이 부분을 놓치면 [구체적 위험]이 있습니다."
- 예시: "특히 환자분의 음주 이력(주 3회 이상)을 고려할 때, 이 부분을 놓치면 간경변으로 진행될 위험이 있습니다."

**step4_offer (정밀 검진 제안)**
- 형식: "따라서 [정밀검진명]을 더해 '[확인 가능한 내용]'과 '[추가 확인 내용]'을 동시에 확인해야 완벽한 안심이 가능합니다."
- 예시: "따라서 간 초음파를 더해 '수치'와 '모양'을 동시에 확인해야 완벽한 안심이 가능합니다."

### 3-2. recommended_item 작성
- **name**: 정밀 검진 항목명
- **category**: 카테고리 (예: 소화기 정밀)
- **is_upselling**: true
- **reason_summary**: 간단한 이유 요약
- **hospital_advantage**: 병원 특장점 (장비, 전문의 등)

## STEP 4: 우선순위 분류

### 4-1. 1순위 (관리하실 항목이에요)
- **목적**: 기본 검진 결과지를 확인할 때 주의 깊게 봐야 하는 항목 안내
- **조건**: 과거 검진(이상/경계) + 문진(추이) + 선택 항목 맥락 모두 매칭
- **포함**: **기본 검진(national_checkup_items) 항목 중 위 조건 매칭 항목만**
- **제외**: 추가 검진(recommended_items, external_checkup_items)은 포함하지 않음
- **구성 원칙**: 
  * 사용자가 문진/앞단계에서 걱정하는 부분의 데이터 기반
  * 전반적인 사항에서 기본 검진 상에서 주의 깊게 봐야 하는 항목
  * 논리와 의학적 근거(에비던스)를 기반으로 구성
- **표현**: "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다"
- **description 필드 작성 규칙**: 
  * **절대 프롬프트의 예시 텍스트를 그대로 사용하지 마세요**
  * 사용자에게 보여줄 친근하고 자연스러운 설명을 작성하세요
  * 예시: "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다."
  * 프롬프트의 지시사항이나 기술적 용어(national_checkup_items, recommended_items 등)는 포함하지 마세요
- **focus_items 필드 작성 규칙 (중요)**:
  * **priority_1.items의 각 항목에 대해 focus_items 배열을 반드시 생성하세요**
  * **basic_checkup_guide.focus_items와 동일한 형식과 내용으로 작성하세요** (중복 생성하지 말고, priority_1.focus_items에만 작성)
  * 각 focus_item은 다음 정보를 포함:
    - `item_name`: priority_1.items의 항목명과 **정확히 일치**해야 함 (예: '혈압측정', '체질량지수', '신체계측')
    - `why_important`: 과거 검진 결과 + 문진 내용 + 선택 항목 맥락을 종합하여 이 항목이 왜 중요한지 친근하게 설명 (반드시 구체적인 이유 포함)
    - `check_point`: 확인할 때 주의할 포인트를 친근한 톤으로 작성 (예: "올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.")
  * **basic_checkup_guide는 선택적으로 생성할 수 있으나, priority_1.focus_items가 우선됩니다**

### 4-2. 2순위 (병원 추천)
- **조건**: 병원 특화 검진 + 나이별 권장 + 과거 이력/문진/선택 항목 매칭
- **목적**: 업셀링 (투자 가치 관점)
- **개수 제한**: **priority_2.items는 최대 2-3개만 추천하세요.** 너무 많으면 사용자가 부담을 느낄 수 있습니다.
- **카테고리 구분**: 
  * **comprehensive 카테고리**: hospital_recommended 또는 hospital_external_checkup에서 category가 'comprehensive'인 항목은 priority_2에 추천
  * **일반 추천 항목**: 나이별 권장 검진 중 과거 이력/문진/선택 항목이 매칭되는 항목
- **외부 검사 항목 활용**:
  * **target_trigger 매칭**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger가 매칭되는 항목을 우선 추천
  * **difficulty_level**: Mid(추천) 또는 High(프리미엄) 항목을 priority_2에 포함
  * **The Bridge Strategy**: gap_description을 활용하여 기본 검진의 한계를 설명하고, solution_narrative를 활용하여 자연스럽게 업셀링
  * **category/sub_category**: 환자의 건강 상태와 관련된 카테고리 항목을 우선 추천

### 4-3. 3순위 (선택 검진)
- **조건**: 예방 차원, 추가 확인
- **목적**: 선택적 보완
- **개수 제한**: **priority_3.items는 최대 2-3개만 추천하세요.** 선택적 항목이므로 과도하게 추천하지 마세요.
- **카테고리 구분**:
  * **optional 카테고리**: hospital_external_checkup에서 category가 'optional'인 항목은 priority_3에 추천
  * **예방 차원 항목**: 난이도가 낮고 부담 없는 항목
- **외부 검사 항목 활용**:
  * **difficulty_level**: Low(부담없는) 항목을 priority_3에 포함하거나, High(프리미엄) 항목 중 선택적으로 고려
  * **target_trigger 매칭**: 환자 상황과 부분적으로 매칭되는 항목도 포함 가능
  * **category/sub_category**: 예방 차원에서 고려할 수 있는 카테고리 항목

## STEP 5: 추천 이유 작성 (reason 필드)

### 5-1. 일반검진 항목인 경우 (priority_1에만 포함)
- **판단 기준**: hospital_national_checkup에 포함된 항목인지 확인
- **형식**: "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다."
- **맥락**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요."
- **친근한 표현**: "이유를 알려드리니", "이 부분은 잘 봐주세요", "눈여겨보시길 바랍니다"
- **위치**: 반드시 priority_1.items와 priority_1.national_checkup_items에 포함
- **예시**: "혈압 측정", "혈액검사", "소변검사" 등 (기본 검진 항목)

### 5-2. 일반검진이 아닌 경우 (병원 추천 항목)
- **형식**: "과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다."
- **추가**: "[나이별 권장 검진과도 매칭됩니다]" (해당 시)

### 5-3. 외부 검사 항목인 경우 (hospital_external_checkup)
- **target_trigger 활용**: 환자의 과거 검진 결과, 문진 내용, 선택 항목과 target_trigger를 비교하여 매칭 여부 확인
- **gap_description 활용**: 기본 검진의 한계를 gap_description을 참고하여 설명 (예: "하지만 [gap_description 내용]")
- **solution_narrative 활용**: 이 검사가 왜 필요한지 solution_narrative를 참고하여 설명 (예: "[solution_narrative 내용]")
- **형식**: "과거 검진에서 [XX], 문진에서 [YY], 선택 항목 [ZZ]를 고려할 때, [gap_description]. 따라서 [solution_narrative]"
- **category/sub_category 활용**: 환자의 건강 상태와 관련된 카테고리인지 확인하여 추천
- **⚠️ 검사 설명 시 필수 지침**:
  - **'키트' 단어 사용 금지**: 아이캔서치(ai-CANCERCH), 캔서파인드, 마스토체크(MASTOCHECK) 등 혈액 기반 검사는 절대 '키트'라고 표현하지 마세요. '검사(Test)' 또는 '선별 검사(Screening)'라고 칭하세요.
  - **예외**: 대장암 분변 검사(얼리텍 대장암 검사 등)처럼 박스 형태로 제공되는 경우에만 예외적으로 '키트 형태'라고 묘사할 수 있습니다.
  - **확진 vs 위험도 예측**: 이 검사들은 **'확진(Diagnosis)'**이 아니라 **'위험도 예측(Risk Assessment)'** 또는 **'선별 검사(Screening)'**임을 명확히 설명하세요.
  - **검사 성격 명시**: "이 검사는 확진을 위한 것이 아니라, 위험도를 평가하고 조기 발견을 위한 선별 검사입니다"라는 맥락을 포함하세요.
- **⚠️ 검사 설명 시 필수 지침**:
  - **'키트' 단어 사용 금지**: 아이캔서치(ai-CANCERCH), 캔서파인드, 마스토체크(MASTOCHECK) 등 혈액 기반 검사는 절대 '키트'라고 표현하지 마세요. '검사(Test)' 또는 '선별 검사(Screening)'라고 칭하세요.
  - **예외**: 대장암 분변 검사(얼리텍 대장암 검사 등)처럼 박스 형태로 제공되는 경우에만 예외적으로 '키트 형태'라고 묘사할 수 있습니다.
  - **확진 vs 위험도 예측**: 이 검사들은 **'확진(Diagnosis)'**이 아니라 **'위험도 예측(Risk Assessment)'** 또는 **'선별 검사(Screening)'**임을 명확히 설명하세요.
  - **검사 성격 명시**: "이 검사는 확진을 위한 것이 아니라, 위험도를 평가하고 조기 발견을 위한 선별 검사입니다"라는 맥락을 포함하세요.

## STEP 6: 의학적 근거 및 참고 자료

### 6-1. evidence 작성
- **각주 형식**: "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면..."
- **필수 요소**: 가이드라인, 연구 결과, 한국인 기준 언급
- **절대 금지**: 블로그, 유튜브, 개인 의견, 상업적 웹사이트 등 비학술적 자료는 절대 사용하지 마세요

### 6-2. references 작성
- **형식**: ["https://pubmed.ncbi.nlm.nih.gov/12345678", "https://www.kma.org/..."]
- **조건**: 논문 기반 자료만 사용 (PubMed, Google Scholar, 공식 가이드라인)
- **절대 금지**: 
  * 블로그 (blog, naver.com/blog, tistory.com 등)
  * 유튜브 (youtube.com, youtu.be 등)
  * 개인 의견이나 상업적 웹사이트
  * 신뢰할 수 없는 의학 정보 사이트
  * 위 목록에 없는 모든 웹사이트

**신뢰할 수 있는 의학 자료 출처 목록 (반드시 이 목록에서만 참조하세요):**

**우선순위: 한국 자료를 최우선으로 사용하세요. 한국 자료가 없을 때만 PubMed를 사용하세요.**

1. **PubMed (국제 의학 논문 데이터베이스) - 한국 자료가 없을 때만 사용**
   - https://pubmed.ncbi.nlm.nih.gov/
   - 예시: https://pubmed.ncbi.nlm.nih.gov/12345678
   - **주의**: 한국 자료를 먼저 찾고, 없을 때만 PubMed 사용

**한국 의학 자료 (우선 사용):**

2. **대한의학회 (한국 의학 가이드라인)**
   - https://www.kma.org/
   - https://www.kma.org/kor/

3. **질병관리청 (한국 공공 보건 가이드라인)**
   - https://www.kdca.go.kr/
   - https://www.cdc.go.kr/

4. **대한심장학회**
   - https://www.circulation.or.kr/
   - https://www.koreanheart.org/

5. **대한당뇨학회**
   - https://www.diabetes.or.kr/

6. **대한고혈압학회**
   - https://www.koreanhypertension.org/

7. **대한암학회**
   - https://www.cancer.or.kr/

8. **대한소화기학회**
   - https://www.gastro.or.kr/

9. **대한내분비학회**
   - https://www.endocrinology.or.kr/

**중요 규칙:**
- **한국 자료를 최우선으로 사용하세요** (대한의학회, 질병관리청, 각 전문 학회 등)
- 한국 자료가 없을 때만 PubMed를 사용하세요
- 각주 형식으로 인용: "대한의학회 가이드라인에 따르면[1], 최신 연구 결과[2]에 의하면..."
- references 배열에는 실제 URL을 정확하게 포함하세요
- 각주 매칭: 텍스트의 [1], [2]와 references 배열 인덱스 매칭 (1번째 각주 = references[0])
- 위 목록에 없는 웹사이트는 절대 사용하지 마세요

## STEP 7: 최종 검증 체크리스트

✅ **priority_1 구분**: priority_1.items는 반드시 hospital_national_checkup에 포함된 항목만 포함
✅ **priority_1 제외**: hospital_recommended, hospital_external_checkup 항목은 priority_1에 포함하지 않음
✅ **priority_1 일치**: priority_1.items와 priority_1.national_checkup_items는 동일한 항목이어야 함
✅ **일반검진 표현**: "주의깊게 확인" 사용, "추천" 표현 금지
✅ **추가 검진 위치**: 심전도, 24시간 홀터 심전도 등 추가 검진은 priority_2 또는 priority_3에 포함
✅ **bridging_narrative**: 4단계 모두 작성 (anchor → gap → context → offer)
✅ **맥락 연결**: 과거 검진 + 문진 + 선택 항목 모두 언급
✅ **논리/에비던스**: 각 항목은 논리와 의학적 근거(에비던스)를 기반으로 구성
✅ **각주 형식**: 텍스트에 [1], [2] 표시, references 배열과 매칭
✅ **우선순위**: 1순위(기본 검진 주의 항목) → 2순위(병원 추천) → 3순위(선택)
✅ **개수 제한**: 전체 추천 항목 5-15개
✅ **의학적 정확성**: 실제 존재하는 검진 항목만 사용
✅ **성별 필터링**: 환자 성별과 일치하는 검진 항목만 추천 (남성 환자에게는 여성 전용 검진 절대 금지)

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt

# 기존 함수 호환성 유지 (래퍼 함수)
def create_checkup_design_prompt(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> str:
    """
    검진 설계를 위한 GPT 프롬프트 생성 (기존 호환성 유지)
    내부적으로 레거시 함수를 호출합니다.
    """
    return create_checkup_design_prompt_legacy(
        patient_name=patient_name,
        patient_age=patient_age,
        patient_gender=patient_gender,
        health_data=health_data,
        prescription_data=prescription_data,
        selected_concerns=selected_concerns,
        survey_responses=survey_responses,
        hospital_national_checkup=hospital_national_checkup,
        hospital_recommended=hospital_recommended,
        hospital_external_checkup=hospital_external_checkup,
        prescription_analysis_text=prescription_analysis_text,
        selected_medication_texts=selected_medication_texts
    )


def create_checkup_design_prompt_step1(
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> str:
    """
    STEP 1: 빠른 분석 전용 프롬프트 생성
    검진 항목 추천 없이 분석만 수행합니다.
    
    Args:
        patient_name: 환자 이름
        patient_age: 환자 나이
        patient_gender: 환자 성별 (M/F)
        health_data: 최근 3년간 건강검진 데이터
        prescription_data: 약물 복용 이력 데이터
        selected_concerns: 사용자가 선택한 염려 항목 리스트
        survey_responses: 설문 응답
        hospital_national_checkup: 병원 기본 검진 항목
        prescription_analysis_text: 약품 분석 결과 텍스트
        selected_medication_texts: 선택된 약품 텍스트
    
    Returns:
        GPT 프롬프트 문자열 (분석 전용)
    """
    # 현재 날짜 계산
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)
    current_date_str = today.strftime("%Y년 %m월 %d일")
    five_years_ago_str = five_years_ago.strftime("%Y년 %m월 %d일")
    
    # 환자 정보 섹션
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 현재 날짜: {current_date_str}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"

    # 건강 데이터 섹션 (간소화 - 분석에 필요한 핵심 정보만)
    health_data_section = ""
    if health_data:
        health_data_section = "\n## 과거 건강검진 데이터 (최근 5년)\n"
        health_data_section += f"분석 기간: {five_years_ago_str} ~ {current_date_str}\n\n"
        
        # 최근 3년 데이터만 사용 (빠른 분석을 위해)
        recent_data = sorted(health_data, key=lambda x: x.get('checkup_date', ''), reverse=True)[:3]
        
        for idx, record in enumerate(recent_data, 1):
            # 날짜 및 병원명 추출
            checkup_date = record.get('checkup_date') or record.get('CheckUpDate') or '날짜 미상'
            checkup_year = record.get('year', '')
            hospital_name = record.get('location') or record.get('Location') or record.get('hospital_name', '병원명 미상')
            
            # 년도와 날짜 조합
            if checkup_year and checkup_date != '날짜 미상':
                date_display = f"{checkup_year}년 {checkup_date}"
            elif checkup_year:
                date_display = f"{checkup_year}년"
            else:
                date_display = checkup_date
            
            health_data_section += f"### {idx}. {date_display} - {hospital_name}\n"
            
            # 이상/경계 항목 추출 (raw_data.Inspections에서)
            abnormal_items = []
            warning_items = []
            raw_data = record.get('raw_data') or {}
            
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            
            if isinstance(raw_data, dict) and raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:  # 최대 5개 검사
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:  # 최대 5개 질환
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:  # 최대 10개 항목
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    item_unit = item.get("Unit") or ""
                                    
                                    # ItemReferences 확인하여 상태 분류
                                    if item.get("ItemReferences"):
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            
                                            # 이상 항목
                                            if "질환의심" in ref_name or "이상" in ref_name:
                                                abnormal_items.append(f"- {item_name}: {item_value} {item_unit} (이상)")
                                                break
                                            # 경계 항목
                                            elif "정상(B)" in ref_name or "경계" in ref_name:
                                                warning_items.append(f"- {item_name}: {item_value} {item_unit} (경계)")
                                                break
            
            if abnormal_items:
                health_data_section += "**이상 항목:**\n" + "\n".join(abnormal_items) + "\n\n"
            if warning_items:
                health_data_section += "**경계 항목:**\n" + "\n".join(warning_items) + "\n\n"
            if not abnormal_items and not warning_items:
                health_data_section += "이상 소견 없음\n\n"
    else:
        health_data_section = "\n## 과거 건강검진 데이터\n"
        health_data_section += "검진 이력이 확인되지 않습니다.\n"
        health_data_section += "\n**절대 금지:** 검진 데이터가 없다고 해서 '5년간 이상소견이 없었다', '경계 소견이 없었다', '검진을 하지 않아서' 같은 판단을 하지 마세요. "
        health_data_section += "우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다. "
        health_data_section += "정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아' "
        health_data_section += "절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서' "
        health_data_section += "데이터 부재는 '확인 불가' 또는 '확인되지 않음'으로만 표현하고, 추측이나 가정을 하지 마세요.\n"

    # 처방전 데이터 섹션 (간소화)
    prescription_section = ""
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section = "\n## 약물 복용 이력 분석\n" + clean_analysis_text + "\n"
    elif prescription_data:
        prescription_section = "\n## 약물 복용 이력\n"
        # 최근 처방전만 요약
        recent_prescriptions = sorted(prescription_data, key=lambda x: x.get('prescription_date', ''), reverse=True)[:5]
        medication_summary = []
        for rx in recent_prescriptions:
            med_name = rx.get('medication_name', '')
            period = rx.get('period', '')
            if med_name:
                medication_summary.append(f"- {med_name} ({period})")
        if medication_summary:
            prescription_section += "\n".join(medication_summary) + "\n"

    # 선택한 염려 항목 섹션
    concerns_section = ""
    if selected_concerns:
        concerns_section = "\n## 사용자가 선택한 염려 항목\n"
        for idx, concern in enumerate(selected_concerns, 1):
            concern_type = concern.get('type', '')
            concern_name = concern.get('name', '')
            concern_date = concern.get('date', '')
            concern_value = concern.get('value', '')
            concern_unit = concern.get('unit', '')
            concern_status = concern.get('status', '')
            
            concerns_section += f"{idx}. {concern_name}"
            if concern_date:
                concerns_section += f" ({concern_date})"
            if concern_value:
                concerns_section += f": {concern_value} {concern_unit}"
            if concern_status:
                concerns_section += f" [{concern_status}]"
            concerns_section += "\n"

    # 문진 응답 섹션
    survey_section = ""
    if survey_responses:
        survey_section = "\n## 문진 응답\n"
        # 핵심 문진 항목만 포함
        key_items = ['weight_change', 'exercise_frequency', 'family_history', 'smoking', 'drinking', 
                     'sleep_hours', 'stress_level', 'cancer_history', 'hepatitis_carrier']
        for key in key_items:
            value = survey_responses.get(key)
            if value:
                key_name_map = {
                    'weight_change': '체중 변화',
                    'exercise_frequency': '운동 빈도',
                    'family_history': '가족력',
                    'smoking': '흡연',
                    'drinking': '음주',
                    'sleep_hours': '수면 시간',
                    'stress_level': '스트레스 수준',
                    'cancer_history': '암 병력',
                    'hepatitis_carrier': '간염 보균자 여부'
                }
                survey_section += f"- {key_name_map.get(key, key)}: {value}\n"

    # 기본 검진 항목 섹션 (간소화)
    national_checkup_section = ""
    if hospital_national_checkup:
        national_checkup_section = "\n## 병원 기본 검진 항목\n"
        national_checkup_section += "다음 항목들은 기본 검진에 포함되어 있습니다:\n"
        # 안전하게 item_name 추출 (딕셔너리인 경우만)
        item_names = []
        for item in hospital_national_checkup[:10]:  # 처음 10개만
            if isinstance(item, dict):
                item_names.append(item.get('item_name', ''))
            elif isinstance(item, str):
                item_names.append(item)
            else:
                item_names.append(str(item))
        national_checkup_section += ", ".join(item_names)
        if len(hospital_national_checkup) > 10:
            national_checkup_section += f" 외 {len(hospital_national_checkup) - 10}개"
        national_checkup_section += "\n"

    # Master DB 섹션 추가
    master_knowledge_section = build_master_knowledge_section()
    
    # 프롬프트 조합
    prompt = f"""{master_knowledge_section}

# Role
당신은 베테랑 헬스 큐레이터이자 건강 데이터 분석 전문가입니다.

# Task
환자의 과거 검진 데이터와 문진(설문) 내용을 분석하여 현재 건강 상태와 위험 요인을 진단해주세요.

**중요: 검진 항목을 추천하기 전, 환자가 자신의 상태를 이해할 수 있도록 '분석 리포트'만 먼저 작성합니다.**

{patient_info}{health_data_section}{prescription_section}{concerns_section}{survey_section}{national_checkup_section}

# Output Format (JSON)

반드시 다음 JSON 형식으로만 응답하세요:

{{
  "patient_summary": "환자 상태 3줄 요약 (과거 검진 이력, 현재 건강 상태, 주요 위험 요인)",
  "analysis": "종합 분석 (과거 수치와 현재 생활습관의 연관성 중심, 강조 태그 사용 가능: {{highlight}}텍스트{{/highlight}})",
  "risk_profile": [
    {{
      "organ_system": "대상 장기 (예: 위, 간, 심뇌혈관)",
      "risk_level": "Low / Moderate / High / Very High (시스템 지식 베이스 기준)",
      "reason": "판단 근거 (데이터+문진 결합). (예: 직계 가족력과 흡연력이 결합되어 위험도 상승)"
    }}
  ],
  "chronic_analysis": {{
    "has_chronic_disease": true/false,
    "disease_list": ["고혈압", "당뇨" 등],
    "complication_risk": "만성질환으로 인해 확인해야 할 합병증 타겟 (예: 고혈압이 있어 눈/콩팥/심장 확인 필요)"
  }},
  "survey_reflection": "문진 내용이 검진 설계에 어떻게 반영될지 예고 (강조 태그 사용 가능)",
  "selected_concerns_analysis": [
    {{
      "concern_name": "염려 항목명 (예: 건강검진 (2020년 09/28) [이상] 또는 혈당 (2023년 05/15) [경계])",
      "concern_type": "checkup|hospital|medication",
      "trend_analysis": "과거 추이 분석 (강조 태그 사용 가능: {{highlight}}중요 내용{{/highlight}})",
      "reflected_in_design": "검진 설계에 어떻게 반영될지 (강조 태그 사용 가능: {{highlight}}중요 내용{{/highlight}})",
      "related_items": []
    }}
  ],
  
  **중요 규칙 (concern_name):**
  - concern_name에는 반드시 년도가 포함되어야 합니다 (예: "2020년 09/28" 또는 "2020/09/28")
  - status는 한글로 표시하세요: "abnormal" → "[이상]", "warning" → "[경계]"
  - 영어 "abnormal" 또는 "warning"을 사용하지 마세요
  - 날짜 형식: "건강검진 (2020년 09/28) [이상]" 또는 "혈당 (2023년 05/15) [경계]"
  
  **중요 규칙 (trend_analysis, reflected_in_design):**
  - trend_analysis와 reflected_in_design에서 주요 사항을 강조하려면 {{highlight}}텍스트{{/highlight}} 태그를 사용하세요
  - 중요한 내용, 위험 요인, 핵심 포인트 등을 하이라이트하여 사용자가 쉽게 파악할 수 있도록 하세요
  
  **중요 규칙 (risk_profile):**
  - 위험도 분석 로직을 기반으로 각 장기별로 위험도를 명확히 분류하세요
  - Low / Moderate / High / Very High Risk 중 하나를 선택하세요
  - 판단 근거는 반드시 데이터와 문진 내용을 결합하여 설명하세요
  
  **중요 규칙 (chronic_analysis):**
  - 만성질환이 있다면 반드시 합병증 위험을 명시하세요
  - 예: 고혈압 -> 눈/콩팥/심장, 당뇨 -> 안저/췌장/신장 등
  
  "basic_checkup_guide": {{
    "title": "일반검진, 이 부분은 잘 보세요",
    "description": "일반검진 결과지를 확인하실 때, [환자명]님 상황에서는 아래 항목들을 특히 잘 살펴보시길 바랍니다.",
    "focus_items": [
      {{
        "item_name": "항목명 (기본 검진 항목)",
        "why_important": "왜 중요한지 설명 (과거 검진 + 문진 + 선택 항목 맥락)",
        "check_point": "확인 포인트 설명"
      }}
    ]
  }}
}}

# 작성 가이드

## patient_summary
- 3줄로 환자 상태 요약
- 과거 검진 이력, 현재 건강 상태, 주요 위험 요인 포함
- **검진 데이터 표현 정확화 필수:**
  * 정확한 표현: '검진 내용이 확인되지 않았다', '검진 데이터가 제공되지 않아', '검진 이력이 확인되지 않아'
  * 절대 사용하지 말 것: '검진이 없었다', '검진을 하지 않아서', '검진을 받지 않아서', '5년간 이상소견이 없었다'
  * 우리가 갖고 있는 데이터나 고객이 우리에게 제공하지 않은 데이터가 있을 뿐, 검진이 있었는지 없었는지 모르는 것입니다

## analysis
- 과거 검진 데이터와 문진 내용의 연관성 분석
- 특히 안 좋았던 항목(이상/경계)과 문진 내용의 연결점 강조
- 강조 태그 사용 가능: {{highlight}}중요 내용{{/highlight}}
- **⚠️ 오래된 데이터만 있는 경우 필수 코멘트:**
  * 프롬프트에 "5년 이상 오래된 데이터만 있다"는 지시가 포함된 경우, 반드시 다음 내용을 analysis에 포함하세요:
  * "가장 최근 검진이 5년 이상 전이므로, 현재 건강 상태를 정확히 파악하기 어렵습니다."
  * "최근 건강 상태 변화를 확인하기 위해 새로운 검진이 필요합니다."
  * "나이, 생활습관 변화, 가족력 등을 고려하여 종합적인 검진을 권장합니다."

## risk_profile
- 위험도 분석 로직을 기반으로 각 장기별로 위험도를 명확히 분류
- Low / Moderate / High / Very High Risk 중 하나를 선택
- 판단 근거는 반드시 데이터와 문진 내용을 결합하여 설명
- 예시: "위 (Stomach) - High Risk: 위축성 위염 이력과 헬리코박터 보균이 확인되어 위암 위험이 높습니다"

## chronic_analysis
- 만성질환이 있다면 반드시 합병증 위험을 명시
- has_chronic_disease: true/false
- disease_list: 만성질환 목록 (예: ["고혈압", "당뇨"])
- complication_risk: 만성질환으로 인해 확인해야 할 합병증 타겟
- 예시: "고혈압이 있어 눈(망막), 콩팥(신장 기능), 심장(심비대) 확인 필요"

## survey_reflection
- 문진 내용이 검진 설계에 어떻게 반영될지 예고
- "문진에서 확인된 XX를 고려하여..." 형식
- 강조 태그 사용 가능

## selected_concerns_analysis
- 사용자가 선택한 각 염려 항목별로 분석
- 과거 추이 분석과 검진 설계 반영 방안 포함
- **⚠️ 중요 - 구체적 항목명 나열 필수**: "여러 항목이 이상으로 나타났다"처럼 모호한 표현 금지. 반드시 구체적인 항목명을 나열하세요.
  - ❌ 잘못된 예: "여러 항목이 경계로 나타났습니다"
  - ✅ 올바른 예: "혈압, 허리둘레, 간기능 수치가 경계 수준으로 확인되었습니다"

## basic_checkup_guide
- 기본 검진 항목 중에서 주의 깊게 봐야 할 항목 식별
- focus_items는 hospital_national_checkup에 포함된 항목만
- 과거 검진 + 문진 + 선택 항목이 모두 매칭되는 항목만 포함

**검진 항목 추천은 포함하지 마세요. 분석만 수행하세요.**

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요."""
    
    return prompt



async def create_checkup_design_prompt_step2(
    step1_result: Dict[str, Any],
    patient_name: str,
    patient_age: Optional[int],
    patient_gender: Optional[str],
    health_data: List[Dict[str, Any]],
    prescription_data: List[Dict[str, Any]],
    selected_concerns: List[Dict[str, Any]],
    survey_responses: Optional[Dict[str, Any]] = None,
    hospital_national_checkup: Optional[List[Dict[str, Any]]] = None,
    hospital_recommended: Optional[List[Dict[str, Any]]] = None,
    hospital_external_checkup: Optional[List[Dict[str, Any]]] = None,
    prescription_analysis_text: Optional[str] = None,
    selected_medication_texts: Optional[List[str]] = None
) -> tuple[str, List[Dict[str, Any]]]:
    """
    STEP 2: 설계 및 근거 전용 프롬프트 생성 (RAG 통합)
    STEP 1의 분석 결과를 컨텍스트로 받아 검진 항목을 설계하고 의학적 근거를 확보합니다.
    RAG 시스템을 통해 최신 의학 가이드라인을 검색하여 프롬프트에 통합합니다.
    
    Returns:
        tuple[str, List[Dict]]: (프롬프트 문자열, 구조화된 에비던스 리스트)
    """
    # STEP 1 결과를 JSON 문자열로 변환
    step1_result_json = json.dumps(step1_result, ensure_ascii=False, indent=2)
    
    # RAG 검색 수행 (구조화된 에비던스 반환)
    rag_evidence_context = ""
    structured_evidences = []
    try:
        # RAG 엔진 초기화
        query_engine = await init_rag_engine()
        
        if query_engine:
            # 환자 컨텍스트 구성
            patient_context = {
                "age": patient_age or 40,
                "gender": "male" if patient_gender and patient_gender.upper() == "M" else "female",
                "family_history": [],
                "abnormal_items": []
            }
            
            # 설문 응답에서 가족력 추출
            if survey_responses:
                family_history_raw = survey_responses.get('family_history', '')
                if isinstance(family_history_raw, str) and family_history_raw:
                    patient_context['family_history'] = [fh.strip() for fh in family_history_raw.split(',') if fh.strip()]
                elif isinstance(family_history_raw, list):
                    patient_context['family_history'] = family_history_raw
            
            # STEP 1 결과에서 과거 검진 이상 항목 추출
            risk_profile = step1_result.get("risk_profile", [])
            for risk in risk_profile:
                if isinstance(risk, dict):
                    factor = risk.get("factor", "")
                    level = risk.get("level", "")
                    if level in ['주의', '경계', '이상']:
                        patient_context['abnormal_items'].append({
                            "name": factor,
                            "status": level
                        })
            
            # RAG 검색 실행
            rag_result = await get_medical_evidence_from_rag(
                query_engine=query_engine,
                patient_context=patient_context,
                concerns=selected_concerns
            )
            
            rag_evidence_context = rag_result.get("context_text", "")
            structured_evidences = rag_result.get("structured_evidences", [])
            
            print(f"[INFO] RAG 검색 완료 - {len(structured_evidences)}개 에비던스, {len(rag_evidence_context)}자")
        else:
            print("[WARN] RAG 엔진을 사용할 수 없어 하드코딩된 지식을 사용합니다.")
    except Exception as e:
        print(f"[ERROR] RAG 검색 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        # RAG 실패 시에도 프롬프트는 계속 진행
    
    # 현재 날짜 계산
    today = datetime.now()
    five_years_ago = today - timedelta(days=5*365)
    current_date_str = today.strftime("%Y년 %m월 %d일")
    five_years_ago_str = five_years_ago.strftime("%Y년 %m월 %d일")
    
    # 환자 정보 섹션
    patient_info = f"""## 환자 정보
- 이름: {patient_name}
- 현재 날짜: {current_date_str}
"""
    if patient_age:
        patient_info += f"- 나이: {patient_age}세\n"
    if patient_gender:
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        patient_info += f"- 성별: {gender_text}\n"

    # STEP 1 분석 결과 섹션 (컨텍스트)
    step1_context = f"""
## STEP 1 분석 결과 (컨텍스트)

앞서 진행된 환자 분석 결과는 다음과 같습니다:

```json
{step1_result_json}
```

**중요 지시사항:**

1. **위험도 계층화 활용**: STEP 1의 risk_profile을 기반으로 각 장기별 위험도(High/Very High Risk)에 맞는 정밀 검사를 매칭하세요.

2. **만성질환 연쇄 반응 반영**: STEP 1의 chronic_analysis를 확인하여, 만성질환이 있다면 반드시 합병증 검사를 연쇄적으로 추천하세요.
   - 고혈압 -> 경동맥 초음파(뇌졸중), 심장 초음파(심비대), 신장 기능
   - 당뇨 -> 안저검사(망막), 췌장 CT(50세이상), 말초신경
   - 이상지질혈증 -> 관상동맥 석회화 CT, 경동맥 초음파
   - 비만/지방간 -> 간 섬유화 스캔, 요산(통풍), 인슐린 저항성

3. **Bridge Strategy 강제**: 모든 정밀 검진 추천 시 반드시 4단계 구조(anchor → gap → context → offer)를 사용하세요.

4. **의학적 근거 매핑**: 모든 추천 항목에는 실제 의학적 근거(URL)를 매핑하세요.
"""

    # 건강 데이터 섹션 (간소화)
    health_data_section = ""
    if health_data:
        health_data_section = "\n## 과거 건강검진 데이터 (참고용)\n"
        health_data_section += f"분석 기간: {five_years_ago_str} ~ {current_date_str}\n\n"
        recent_data = sorted(health_data, key=lambda x: x.get('checkup_date', '') or x.get('year', ''), reverse=True)[:3]
        for idx, record in enumerate(recent_data, 1):
            # 날짜 및 병원명 추출
            checkup_date = record.get('checkup_date') or record.get('CheckUpDate') or '날짜 미상'
            checkup_year = record.get('year', '')
            hospital_name = record.get('location') or record.get('Location') or record.get('hospital_name', '병원명 미상')
            
            # 년도와 날짜 조합
            if checkup_year and checkup_date != '날짜 미상':
                date_display = f"{checkup_year}년 {checkup_date}"
            elif checkup_year:
                date_display = f"{checkup_year}년"
            else:
                date_display = checkup_date
            
            health_data_section += f"### {idx}. {date_display} - {hospital_name}\n"
            
            # 이상/경계 항목 추출 (raw_data.Inspections에서)
            abnormal_items = []
            warning_items = []
            raw_data = record.get('raw_data') or {}
            
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            
            if isinstance(raw_data, dict) and raw_data.get("Inspections"):
                for inspection in raw_data["Inspections"][:5]:  # 최대 5개 검사
                    if inspection.get("Illnesses"):
                        for illness in inspection["Illnesses"][:5]:  # 최대 5개 질환
                            if illness.get("Items"):
                                for item in illness["Items"][:10]:  # 최대 10개 항목
                                    item_name = item.get("Name") or ""
                                    item_value = item.get("Value") or ""
                                    item_unit = item.get("Unit") or ""
                                    
                                    # ItemReferences 확인하여 상태 분류
                                    if item.get("ItemReferences"):
                                        for ref in item["ItemReferences"]:
                                            ref_name = ref.get("Name") or ""
                                            
                                            # 이상 항목
                                            if "질환의심" in ref_name or "이상" in ref_name:
                                                abnormal_items.append(f"- {item_name}: {item_value} {item_unit} (이상)")
                                                break
                                            # 경계 항목
                                            elif "정상(B)" in ref_name or "경계" in ref_name:
                                                warning_items.append(f"- {item_name}: {item_value} {item_unit} (경계)")
                                                break
            
            if abnormal_items:
                health_data_section += "**이상 항목:**\n" + "\n".join(abnormal_items) + "\n\n"
            if warning_items:
                health_data_section += "**경계 항목:**\n" + "\n".join(warning_items) + "\n\n"
            if not abnormal_items and not warning_items:
                health_data_section += "이상 소견 없음\n\n"

    # 처방전 데이터 섹션
    prescription_section = ""
    if prescription_analysis_text:
        # HTML 태그 제거 (프롬프트에 순수 텍스트만 포함)
        clean_analysis_text = remove_html_tags(prescription_analysis_text)
        prescription_section = "\n## 약물 복용 이력 분석\n" + clean_analysis_text + "\n"
    elif prescription_data:
        prescription_section = "\n## 약물 복용 이력\n"
        recent_prescriptions = sorted(prescription_data, key=lambda x: x.get('prescription_date', ''), reverse=True)[:5]
        medication_summary = []
        for rx in recent_prescriptions:
            med_name = rx.get('medication_name', '')
            period = rx.get('period', '')
            if med_name:
                medication_summary.append(f"- {med_name} ({period})")
        if medication_summary:
            prescription_section += "\n".join(medication_summary) + "\n"

    # 선택한 염려 항목 섹션
    concerns_section = ""
    if selected_concerns:
        concerns_section = "\n## 사용자가 선택한 염려 항목\n"
        for idx, concern in enumerate(selected_concerns, 1):
            concern_type = concern.get('type', '')
            concern_name = concern.get('name', '')
            concern_date = concern.get('date', '')
            concern_value = concern.get('value', '')
            concern_unit = concern.get('unit', '')
            concern_status = concern.get('status', '')
            
            concerns_section += f"{idx}. {concern_name}"
            if concern_date:
                concerns_section += f" ({concern_date})"
            if concern_value:
                concerns_section += f": {concern_value} {concern_unit}"
            if concern_status:
                concerns_section += f" [{concern_status}]"
            concerns_section += "\n"

    # 문진 응답 섹션
    survey_section = ""
    if survey_responses:
        survey_section = "\n## 문진 응답\n"
        key_items = ['weight_change', 'exercise_frequency', 'family_history', 'smoking', 'drinking', 
                     'sleep_hours', 'stress_level', 'cancer_history', 'hepatitis_carrier']
        for key in key_items:
            value = survey_responses.get(key)
            if value:
                key_name_map = {
                    'weight_change': '체중 변화',
                    'exercise_frequency': '운동 빈도',
                    'family_history': '가족력',
                    'smoking': '흡연',
                    'drinking': '음주',
                    'sleep_hours': '수면 시간',
                    'stress_level': '스트레스 수준',
                    'cancer_history': '암 병력',
                    'hepatitis_carrier': '간염 보균자 여부'
                }
                survey_section += f"- {key_name_map.get(key, key)}: {value}\n"

    # 병원 검진 항목 섹션 (전체)
    hospital_items_section = ""
    if hospital_national_checkup:
        hospital_items_section = "\n## 병원 기본 검진 항목\n"
        hospital_items_section += "다음 항목들은 기본 검진에 포함되어 있습니다:\n"
        # 안전하게 item_name 추출 (딕셔너리인 경우만)
        item_names = []
        for item in hospital_national_checkup:
            if isinstance(item, dict):
                item_names.append(item.get('item_name', ''))
            elif isinstance(item, str):
                item_names.append(item)
            else:
                item_names.append(str(item))
        hospital_items_section += ", ".join(item_names[:20])
        if len(hospital_national_checkup) > 20:
            hospital_items_section += f" 외 {len(hospital_national_checkup) - 20}개"
        hospital_items_section += "\n"
    
    if hospital_recommended:
        hospital_items_section += "\n## 병원 추천 검진 항목\n"
        for item in hospital_recommended[:30]:
            if isinstance(item, dict):
                item_name = item.get('item_name', '')
                category = item.get('category', '')
                hospital_items_section += f"- {item_name} ({category})\n"
            elif isinstance(item, str):
                hospital_items_section += f"- {item}\n"
            else:
                hospital_items_section += f"- {str(item)}\n"
    
    if hospital_external_checkup:
        hospital_items_section += "\n## 외부 검사 항목\n"
        hospital_items_section += "**⚠️ 검사 설명 시 필수 지침:**\n"
        hospital_items_section += "1. **'키트' 단어 사용 금지**: 아이캔서치(ai-CANCERCH), 캔서파인드, 마스토체크(MASTOCHECK) 등 혈액 기반 검사는 절대 '키트'라고 표현하지 마세요. '검사(Test)' 또는 '선별 검사(Screening)'라고 칭하세요.\n"
        hospital_items_section += "2. **예외**: 대장암 분변 검사(얼리텍 대장암 검사 등)처럼 박스 형태로 제공되는 경우에만 예외적으로 '키트 형태'라고 묘사할 수 있습니다.\n"
        hospital_items_section += "3. **확진 vs 위험도 예측**: 이 검사들은 **'확진(Diagnosis)'**이 아니라 **'위험도 예측(Risk Assessment)'** 또는 **'선별 검사(Screening)'**임을 명확히 설명하세요.\n"
        hospital_items_section += "4. **검사 성격 명시**: 검사 설명 시 '이 검사는 확진을 위한 것이 아니라, 위험도를 평가하고 조기 발견을 위한 선별 검사입니다'라는 맥락을 포함하세요.\n\n"
        for item in hospital_external_checkup[:30]:
            if isinstance(item, dict):
                item_name = item.get('item_name', '')
                category = item.get('category', '')
                target_trigger = item.get('target_trigger', '')
                gap_description = item.get('gap_description', '')
                solution_narrative = item.get('solution_narrative', '')
                hospital_items_section += f"- {item_name} ({category})\n"
                if target_trigger:
                    hospital_items_section += f"  * 대상: {target_trigger}\n"
                if gap_description:
                    hospital_items_section += f"  * 한계: {gap_description}\n"
                if solution_narrative:
                    hospital_items_section += f"  * 해결: {solution_narrative}\n"
            elif isinstance(item, str):
                hospital_items_section += f"- {item}\n"
            else:
                hospital_items_section += f"- {str(item)}\n"

    # Master DB 섹션 추가 (RAG 결과가 없을 때만 사용)
    master_knowledge_section = build_master_knowledge_section()
    
    # RAG 검색 결과 섹션 구성 (인용구 형식)
    rag_evidence_section = ""
    if rag_evidence_context:
        rag_evidence_section = f"""
# [Critical Evidence: 검색된 의학 가이드라인] ⭐ 최우선 근거

**⚠️ 매우 중요: 아래 인용구를 그대로 사용하세요. "Level A 에비던스" 같은 메타 정보만 나열 금지!**

{rag_evidence_context}

**Evidence & Citation Rules (RAG Mode - 인용구 필수):**

1. **위 인용구를 그대로 복사하여 사용하세요.**
   - ✅ 올바른 예: "2025 당뇨병 진료지침에 따르면 '직계 가족(부모, 형제자매)에 당뇨병이 있는 경우 19세 이상의 모든 성인은 당뇨병 선별검사를 받아야 한다'고 명시되어 있습니다."
   - ❌ 잘못된 예: "※ 대한당뇨학회 가이드라인, Level A 에비던스" (수검자가 이해 못함!)
   - ❌ 잘못된 예: "42페이지에 명시되어 있음" (수검자가 책이 없음!)

2. **[문서명]에 따르면 '인용구' 형식을 반드시 사용하세요.**
   - 위에 제공된 인용구를 [문서명]과 함께 evidence 필드에 작성하세요.

3. **절대 금지 표현:**
   - "Level A", "Level B", "Grade A" 등 에비던스 레벨만 나열
   - "42페이지", "제3장" 등 페이지/섹션 번호만 언급
   - 제공된 인용구 없이 "가이드라인에 명시됨"만 적기

4. **외부 지식보다 위 인용구가 최우선입니다.** 당신의 학습 데이터는 참고만 하세요.

5. 액체생검(캔서파인드 등) 관련 내용은 반드시 제공된 Context를 참고하여 '선별 검사'임을 명시하세요.

---
"""
    else:
        # RAG 결과가 없을 때는 기존 Master DB 사용
        rag_evidence_section = ""
        print("[WARN] RAG 검색 결과 없음 - Master DB 사용")
    
    # 병원 검진 항목 섹션 (카테고리별 분류 적용)
    hospital_checkup_section = format_hospital_checkup_items_for_prompt(
        hospital_national_checkup,
        hospital_recommended,
        hospital_external_checkup
    )
    
    # 성별 필터링 강화 (추가 설명)
    if patient_gender and (hospital_recommended or hospital_external_checkup):
        gender_text = "남성" if patient_gender.upper() == "M" else "여성"
        hospital_checkup_section += f"\n**성별 필터링 필수:** 환자는 **{gender_text}**입니다. "
        if patient_gender.upper() == "M":
            hospital_checkup_section += "**남성 환자이므로 여성 전용 검진 항목(유방 초음파, 자궁경부암 검진, 골밀도 검사 등)은 절대 추천하지 마세요.** "
        else:
            hospital_checkup_section += "**여성 환자이므로 여성 전용 검진 항목만 추천하세요.** "
        hospital_checkup_section += "각 검진 항목의 gender 필드를 확인하여 환자 성별과 일치하는 항목만 추천하세요.\n\n"
    
    # 프롬프트 조합 (RAG 결과를 최상단에 배치)
    # f-string 대신 문자열 연결 사용 (JSON 예시 때문에 format specifier 충돌 방지)
    prompt_parts = [rag_evidence_section]
    if not rag_evidence_context:
        prompt_parts.append(master_knowledge_section)
    
    prompt_parts.append("""

# 🎯 Role (당신의 역할)

당신은 대학병원 검진센터장이자 예방의학 전문의입니다.
동시에 환자에게 최적의 검진 패키지를 제안하는 업셀링 전문가이기도 합니다.

**핵심 역량:**
- 근거 중심 의학(EBM)을 준수하되, 환자가 이해하기 쉽게 설명합니다
- 위험 요인을 적극적으로 발견하고 필요한 검사를 권장합니다
- 의학적 근거를 명확하고 설득력 있게 제시합니다
- 가족력, 연령, 생활습관을 종합적으로 고려합니다

**❌ 절대 금지 표현:**
- "모릅니다", "확실하지 않습니다"
- "의사와 상의하세요", "전문가와 상담하세요"
- "검진 데이터가 없어서 판단할 수 없습니다"

**✅ 대신 사용할 표현:**
- "검진 이력이 확인되지 않아, 현재 건강 상태 파악을 위해 검사가 더욱 시급합니다"
- "정확한 진단을 위해 [구체적 검사]를 권장드립니다"
- "가족력과 연령을 고려할 때, [검사]가 필요합니다"

---

# 📋 Context (이전 단계 분석 결과)

{step1_context}

---

# 🏥 병원 검진 항목 정보

{hospital_checkup_section}

---

# 🎯 Task (수행할 작업)

위 분석 결과를 바탕으로, 실제 수행해야 할 '검진 항목'을 구체적으로 설계하고 의학적 근거(Evidence)를 찾아주세요.

## ⚠️ 최우선 규칙 (반드시 준수!)

1. **priority_1.items와 focus_items는 항목명이 정확히 일치해야 합니다**
   - items에 '혈압측정' → focus_items에도 '혈압측정'
   - ❌ 절대 안됨: items에 '혈압' vs focus_items에 '혈압측정'

2. **가족력 확인 시 관련 검진 항목 반드시 포함**
   - 당뇨 가족력 → priority_1에 '혈당검사' 포함 (RAG 근거 있으면 필수)
   - 고혈압 가족력 → priority_1에 '혈압측정' 포함

3. **priority_1.items는 최소 1개, 최대 3개**
   - 가장 중요하고 주의 깊게 봐야 할 상위 3가지만 선정

4. **모든 추천 항목에 인용구 형식의 evidence 필수**
   - ✅ "[문서명]에 따르면 '[실제 내용]'이라고 명시되어 있습니다"
   - ❌ "Level A 에비던스", "42페이지"

5. **소극적 표현 절대 금지**
   - "모릅니다", "의사와 상의", "판단할 수 없다"

## 📝 요구사항

1. **위험 요인 → 정밀 검사 매칭**
   - STEP 1 분석에서 지적된 위험 요인(예: 음주→간, 혈압→뇌혈관)을 해결할 수 있는 정밀 검사를 매칭하세요
   
2. **Bridge Strategy 사용**
   - strategies 구조를 사용하여 설득 논리를 만드세요
   - Anchor (현재 상황) → Gap (위험) → Offer (해결책)

3. **인용구 형식의 근거 제시**
   - 모든 추천 항목에 RAG 검색 결과 활용
   - "[문서명]에 따르면 '[실제 내용]'" 형식 필수

4. **요약 형식**
   - summary.past_results_summary: STEP 1의 analysis를 참고하되, 간결한 요약
   - summary.survey_summary: 설문 내용 요약
   - summary.correlation_analysis: 상관관계 분석 요약

**Evidence & Citation Rules (RAG Mode - 인용구 필수) ⭐ 가장 중요:**

1. **[Critical Evidence] 섹션의 인용구를 그대로 복사하세요.**
   - 위에 제공된 "문서명" + "인용구"를 evidence 필드에 그대로 사용하세요.
   - ✅ 올바른 예: "2025 당뇨병 진료지침에 따르면 '직계 가족에 당뇨가 있으면 선별검사가 필요하다'고 명시되어 있습니다."
   - ❌ 잘못된 예: "※ 대한당뇨학회 가이드라인, Level A 에비던스" (이건 수검자가 이해 못함!)

2. **외부 지식보다 검색된 인용구가 최우선입니다.**

3. **절대 금지 표현 (수검자가 이해 불가):**
   - "Level A", "Level B", "Grade A" 등 에비던스 레벨만 나열
   - "42페이지", "제3장" 등 페이지/섹션 번호만 언급
   - "가이드라인에 명시됨"만 적고 실제 내용 안적기

4. **⚠️ RAG 검색 결과가 없어도 evidence 필수 생성:**
   - RAG 결과가 비어있거나 부족한 경우, Master DB의 지식 베이스와 일반적인 의학 가이드라인을 참고하세요.
   - 하지만 반드시 **인용구 형식**으로 작성하세요: "[기관명] 가이드라인에 따르면 '[내용]'이 권장됩니다"
   - ✅ 예: "대한고혈압학회 가이드라인에 따르면 '수축기 혈압 140mmHg 이상 시 고혈압 진단을 고려해야 한다'고 명시되어 있습니다."
   - ❌ 예: "※ 대한고혈압학회 권고사항" (내용 없음!)

5. **evidence 필드 작성 형식:**
   ```
   "[문서명/기관명]에 따르면 '[실제 가이드라인 내용]'이라고 명시되어 있습니다. [추가 설명]"
   ```

4. 추천 이유(reason)나 근거(evidence)를 작성할 때는, 검색된 내용 중 어느 부분에서 가져왔는지 명시하세요. (예: "2025 당뇨병 진료지침에 따르면...")

5. **절대 금지:** 제공된 Context에 없는 URL이나 논문 제목을 창작하지 마세요. 차라리 "가이드라인에 명시됨"이라고만 적으세요.

6. 액체생검(캔서파인드 등) 관련 내용은 반드시 제공된 `[Product]` 관련 Context를 참고하여 '선별 검사'임을 명시하세요.

**참고 자료 출처 규칙:**
- RAG 검색 결과에서 제공된 출처를 우선 사용하세요
- references 필드에는 검색된 Context에서 명시된 출처만 포함하세요
- Context에 없는 출처는 절대 창작하지 마세요

{patient_info}{health_data_section}{prescription_section}{concerns_section}{survey_section}{hospital_items_section}

# Output Format (JSON)

반드시 다음 JSON 형식으로만 응답하세요:

{{
  "strategies": [
    {{
      "category": "카테고리명",
      "step1_anchor": "기본 검진에서 확인 가능한 내용",
      "step2_gap": "의학적 한계 노출",
      "step3_patient_context": "환자 맞춤 위험 설명",
      "step4_offer": "정밀 검진 제안"
    }}
  ],
  "summary": {{
    "past_results_summary": "과거 검진 결과 요약 (정상/경계/이상 항목 중심으로)",
    "survey_summary": "문진 내용 요약 (체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등)",
    "correlation_analysis": "과거 결과와 문진 내용의 연관성 분석 및 주의사항",
    
    "priority_1": {{
      "title": "1순위: 관리하실 항목이에요",
      "description": "일반검진 결과지를 확인하실 때, 특히 주의 깊게 살펴보시면 좋을 항목들입니다. 과거 검진 결과와 문진 내용, 그리고 선택하신 항목을 종합하여 선정했습니다.",
      "items": ["기본 검진 항목명 1", "기본 검진 항목명 2"],
      "count": 항목 개수,
      "national_checkup_items": ["일반검진 항목명 1", "일반검진 항목명 2"],
      "national_checkup_note": "일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. (과거 검진에서 XX 경계/이상, 문진에서 YY 확인, ZZ 선택) 맥락: [구체적인 이유를 친근하게 설명]",
      "focus_items": [
        {{
          "item_name": "혈압측정",
          "why_important": "이 항목이 왜 중요한지 구체적으로 설명 (과거 검진 결과, 문진 내용, 선택 항목 맥락을 종합하여 친근하게 설명)",
          "check_point": "확인할 때 주의할 포인트 (친근한 톤으로, 예: '올해 수치가 100을 넘어서면 당뇨 전단계로 진단될 수 있으니 이 부분은 잘 봐주세요.')"
        }}
      ]
    }},
    "priority_2": {{
      "title": "2순위: 병원 추천 검진 항목",
      "description": "나이별 권장 검진 중에서 과거 이력, 문진, 선택 항목이 매칭되는 항목을 맥락과 함께 추천합니다.",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "upselling_focus": true,
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강', '심혈관 및 복부 장기 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }},
    "priority_3": {{
      "title": "3순위: 선택 검진 항목",
      "description": "선택적으로 받을 수 있는 검진 항목 (예방 차원, 추가 확인)",
      "items": ["검진 항목명 1", "검진 항목명 2"],
      "count": 항목 개수 (최대 2-3개만 추천),
      "health_context": "이 검진 항목들이 확인하는 건강 영역 (예: '심혈관 건강', '복부 장기 건강', '대사 건강' 등). 여러 영역이 섞여있으면 '및'으로 연결하세요."
    }}
  }},
  "strategies": [
    {{
      "strategy_title": "매력적인 전략 제목 (예: 침묵의 장기, 췌장까지 완벽하게)",
      "related_concern": "환자가 선택한 염려 항목 or 문진 증상",
      "priority": 1,
      "bridging_narrative": {{
        "step1_anchor": "올해 대상이신 일반검진의 [항목명]으로 [확인 가능한 내용]을 보는 것은 매우 중요합니다.",
        "step2_gap": "하지만 [항목명]은 [구체적 한계]만 보여줄 뿐, [확인 불가능한 내용]은 알 수 없는 '반쪽짜리 확인'입니다.",
        "step3_patient_context": "특히 환자분의 [구체적 증상/가족력/이력]을 고려할 때, 이 부분을 놓치면 [구체적 위험]이 있습니다.",
        "step4_offer": "따라서 [정밀검진명]을 더해 '[확인 가능한 내용]'과 '[추가 확인 내용]'을 동시에 확인해야 완벽한 안심이 가능합니다."
      }},
      "recommended_item": {{
        "name": "복부 조영 CT",
        "category": "소화기 정밀",
        "is_upselling": true,
        "reason_summary": "초음파로 보기 힘든 췌장/담낭의 미세 병변 확인",
        "hospital_advantage": "본 병원의 128채널 CT로 1mm 크기의 병변도 찾아낼 수 있습니다."
      }}
    }}
  ],
  "recommended_items": [
    {{
      "category": "카테고리명 (예: 대장검사, CT검사, MRI검사 등)",
      "category_en": "영문 카테고리명",
      "itemCount": 카테고리별 항목 개수,
      "priority_level": 1 또는 2 또는 3,
      "priority_description": "이 카테고리가 해당 우선순위인 이유 설명",
      "items": [
        {{
          "name": "검진 항목명 (한글)",
          "nameEn": "검진 항목명 (영문)",
          "description": "검진에 대한 간단한 설명 (환자가 이해하기 쉽게)",
          "reason": "이 검진을 추천하는 구체적인 이유 - 맥락을 명확히 설명하세요. "
          "**일반검진 항목인 경우**: '일반검진 결과지를 확인하실 때, 이 이유 때문에 잘 살펴보시길 바랍니다. 과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 부분은 특히 눈여겨보시면 좋겠어요.' "
          "**일반검진이 아닌 경우**: '과거 검진에서 [XX 항목이 경계/이상이었고], 문진에서 [YY를 확인했으며], 사용자가 [ZZ를 선택했으므로] 이 검진이 필요합니다. [나이별 권장 검진과도 매칭됩니다].' "
          "각주 형식으로 참고 자료를 표시하세요",
          "evidence": "의학적 근거 및 참고 자료. **작은 텍스트 형식(각주)**으로 다음을 포함하세요: "
          "1) 가이드라인 (예: '※ 2025 당뇨병 진료지침'), "
          "2) 사례 (예: '※ 유사한 임상 사례에서 효과 확인'), "
          "3) 실험/연구 (예: '※ 최신 연구 결과[1]'), "
          "4) 에비던스 레벨 (예: '※ Level A 에비던스, 강한 근거'). "
          "형식: '※ [가이드라인명], [에비던스 레벨], [연구 인용]' (작게 표시)",
          "references": ["신뢰할 수 있는 의학 자료 출처만 사용하세요. **한국 자료를 최우선으로 사용하고, 한국 자료가 없을 때만 PubMed를 사용하세요.** 반드시 다음 목록에서만 참조: PubMed (pubmed.ncbi.nlm.nih.gov - 한국 자료 없을 때만), 대한의학회 (kma.org), 질병관리청 (kdca.go.kr), 대한심장학회 (circulation.or.kr), 대한당뇨학회 (diabetes.or.kr), 대한고혈압학회 (koreanhypertension.org), 대한암학회 (cancer.or.kr), 대한소화기학회 (gastro.or.kr), 대한내분비학회 (endocrinology.or.kr). 예: https://www.kma.org/... 또는 https://pubmed.ncbi.nlm.nih.gov/12345678 (한국 자료 없을 때만)"],
          "priority": 우선순위 (1-3, 1이 가장 높음),
          "recommended": true,
          "related_to_selected_concern": "선택한 염려 항목과의 연관성 (있는 경우)"
        }}
      ],
      "doctor_recommendation": {{
        "has_recommendation": true/false,
        "message": "의사 추천 메시지 (환자의 실제 데이터를 기반으로 구체적으로 작성)",
        "highlighted_text": "강조할 텍스트 (메시지 내에서)"
      }},
      "defaultExpanded": true/false
    }}
  ],
  "doctor_comment": "마무리 인사 및 검진 독려 메시지",
  "total_count": 전체 추천 검진 항목 개수
}}

# 작성 가이드

## summary 작성 규칙

### past_results_summary
- STEP 1의 analysis를 참고하되, 더 간결한 요약 형식으로 작성
- 과거 검진 결과를 정상/경계/이상 항목 중심으로 요약
- 예시: "최근 5년간 검진 데이터에서 혈압이 경계 범위였고, 최근 3년간 점진적으로 상승 추세입니다."
- **⚠️ 오래된 데이터만 있는 경우 필수 코멘트:**
  * STEP 1의 analysis에 오래된 데이터 관련 코멘트가 포함된 경우, past_results_summary에도 이를 반영하세요
  * "가장 최근 검진이 5년 이상 전이므로, 현재 건강 상태를 정확히 파악하기 어렵습니다."

### survey_summary
- STEP 1의 analysis를 참고하되, 문진 내용만 간결하게 요약
- 체중 변화, 운동, 가족력, 흡연, 음주, 수면, 스트레스 등 핵심 내용만 포함
- 예시: "현재 흡연 중이며, 가족력으로 심장질환이 있습니다. 운동은 주 1-2회 가끔 하며, 체중은 유지 중입니다."

### correlation_analysis
- STEP 1의 analysis를 참고하되, 과거 결과와 문진 내용의 연관성만 간결하게 분석
- 예시: "과거 검진에서 혈압이 경계 범위였고, 현재 흡연과 가족력 심장질환이 있어 심혈관계 위험이 높습니다."

**중요**: STEP 1의 analysis는 종합 분석이고, summary의 세 필드는 요약 형식입니다. STEP 1의 analysis를 참고하되, 더 간결하게 요약하세요.

## strategies
- **The Bridge Strategy 4단계 구조 필수 사용**: 반드시 anchor → gap → context → offer 순서로 작성
- STEP 1 분석 결과(risk_profile, chronic_analysis)를 기반으로 작성
- Bridge Strategy JSON의 예시를 참고하여 각 타겟(위암/소화기, 폐암, 뇌혈관, 유방암 등)에 맞는 논리 구성
- step1_anchor: 기본 검진의 가치 인정
- step2_gap: 기본 검진의 의학적 한계 명확히 노출
- step3_patient_context: 환자 맞춤 위험 설명 (STEP 1의 risk_profile 활용)
- step4_offer: 정밀 검진 제안 (완벽한 안심을 위한 해결책)

## recommended_items
- **STEP 1 위험도 계층화 활용**: STEP 1의 risk_profile에서 High/Very High Risk로 분류된 장기에 대한 정밀 검사를 우선 추천
- **만성질환 연쇄 반응 반영**: STEP 1의 chronic_analysis를 확인하여, 만성질환이 있다면 반드시 합병증 검사를 연쇄적으로 추천
  - 고혈압 -> 경동맥 초음파(뇌졸중), 심장 초음파(심비대), 신장 기능
  - 당뇨 -> 안저검사(망막), 췌장 CT(50세이상), 말초신경
  - 이상지질혈증 -> 관상동맥 석회화 CT, 경동맥 초음파
  - 비만/지방간 -> 간 섬유화 스캔, 요산(통풍), 인슐린 저항성
- **⚠️ 대사 건강-간 섬유화 관계 명확화 필수**:
  * 허리둘레 경계 + 당뇨/고혈압 가족력 → 대사이상지방간(MASLD) 위험
  * MASLD → 간 섬유화 → 간경변/간암 위험
  * reason 필드에 이 연결고리를 명확히 설명: "허리둘레가 경계 이상이고 당뇨 가족력이 있어, 대사이상지방간(MASLD) 위험이 높습니다. MASLD는 간 섬유화로 진행될 수 있어 간 섬유화 스캔(VCTE)을 권장합니다."
- **⚠️ 용어 정확성**: "비만" 대신 "허리둘레 경계/이상", "경계" 대신 "혈압 경계" 같이 정확한 항목명 사용
- priority_1: hospital_national_checkup에 포함된 항목만 (주의 깊게 보실 항목)
- priority_2: hospital_recommended 항목 (추가적으로 확인) - 위험도가 높은 경우 우선 추천
- priority_3: hospital_external_checkup 항목 (선택적으로 고려) - 예방 차원
- 각 항목에 의학적 근거(evidence)와 참고 자료(references) 필수 - 실제 URL 매핑 필수

## summary.priority_1, priority_2, priority_3
- 각 priority별 count, description, items 포함
- priority_1에는 title, national_checkup_items, national_checkup_note, focus_items 포함
- **priority_1.items 개수 제한**: priority_1.items는 최소 1개 이상, 최대 3개까지 추천하세요. 가장 중요하고 주의 깊게 봐야 할 항목을 선정하세요.
- **priority_1.focus_items 작성 시**: STEP 1의 basic_checkup_guide.focus_items를 참고하되, 동일한 형식과 내용으로 작성하세요. STEP 1에서 이미 분석한 항목들을 그대로 활용하세요.
- **⚠️ 가족력 반영 필수**: 문진에서 가족력(당뇨, 고혈압 등)이 확인된 경우, 해당 질환과 관련된 검진 항목을 priority_1.items에 반드시 포함하세요. 예: 가족력에 당뇨가 있으면 '혈당검사'를 priority_1.items에 포함해야 합니다.
- **⚠️ priority_1.items 일관성**: "주요 사항은 아래와 같아요" 섹션에 표시된 항목들은 모두 priority_1.items에 포함되어야 합니다. 예: 혈압과 혈당이 모두 표시되었다면, priority_1.items에도 둘 다 포함되어야 합니다.
- **⚠️ national_checkup_note(간호사 노트) 필수 작성**: 
  * 환자의 과거 검진 결과, 가족력, 생활습관을 종합적으로 고려하여 작성
  * 구체적인 항목명과 수치를 언급하며 격려하는 톤으로 작성
  * 예: "과거 검진에서 혈압과 허리둘레가 경계 수준이었고, 가족력으로 당뇨가 있으시니 올해 건강검진 시 이 부분을 꼭 확인해보세요."

## doctor_comment
- 환자의 실제 데이터를 기반으로 작성
- STEP 1 분석 결과를 참고하여 작성

**의학적 근거(Evidence)와 참고 자료(References)는 반드시 포함하세요.**

---

## ✅ JSON 생성 전 최종 확인 체크리스트

**JSON 응답을 생성하기 전에 반드시 다음을 확인하세요:**

### 1. 항목명 일관성
- □ priority_1.items의 모든 항목이 focus_items에 있는가?
- □ 항목명이 정확히 일치하는가? (예: '혈압' vs '혈압측정')
- □ 일반 카테고리명 대신 구체적 항목명을 사용했는가?

### 2. 가족력 반영
- □ 가족력(당뇨/고혈압/암 등) 확인 시 관련 검진 항목을 포함했는가?
- □ 예: 당뇨 가족력 → priority_1에 '혈당검사' 포함

### 3. 에비던스 품질
- □ 모든 추천 항목에 인용구 형식의 evidence가 있는가?
- □ "Level A", "42페이지" 같은 메타 정보만 나열하지 않았는가?
- □ "[문서명]에 따르면 '[실제 내용]'" 형식을 사용했는가?

### 4. 표현 확인
- □ "모릅니다", "의사와 상의", "판단할 수 없다" 같은 소극적 표현을 사용하지 않았는가?
- □ 구체적인 검사명과 이유를 명시했는가?

### 5. 구체성
- □ "여러 항목" 대신 구체적 항목명을 나열했는가?
- □ "비만" 대신 "허리둘레 경계"처럼 정확한 용어를 사용했는가?

### 6. 완전성
- □ "주요 사항" 섹션에 언급한 항목이 모두 priority_1.items에 있는가?
- □ national_checkup_note(간호사 노트)를 작성했는가?

---

## ❌ 부정 예시 (절대 사용 금지!)

### 잘못된 항목명 일치
```
❌ 틀린 예:
items: ["혈압", "심혈관 건강"]  (일반 카테고리명)
focus_items: [{"item_name": "혈압측정"}]  (items와 불일치)
```

### 잘못된 에비던스
```json
{
  "recommended_items": [
    {
      "name": "경동맥 초음파",
      "evidence": "※ 대한고혈압학회 가이드라인, Level A 에비던스"  // ❌ 수검자 이해 불가
    }
  ]
}
```

### 잘못된 표현
```
"검진 데이터가 없어서 판단할 수 없습니다."  // ❌ 소극적
"의사와 상의하세요."  // ❌ 책임 회피
"여러 항목이 이상으로 나타났다"  // ❌ 구체성 부족
```

---

## ✅ 올바른 예시

### 올바른 항목명 일치
```
✅ 올바른 예:
items: ["혈압측정", "혈당검사"]  (구체적 항목명)
focus_items: [
  {"item_name": "혈압측정"},  (items와 일치)
  {"item_name": "혈당검사"}   (items와 일치)
]
```

### 올바른 에비던스
```json
{
  "recommended_items": [
    {
      "name": "경동맥 초음파",
      "evidence": "대한고혈압학회 가이드라인에 따르면 '고혈압 환자에서 뇌졸중 위험 평가를 위해 경동맥 초음파 검사가 권장된다'고 명시되어 있습니다."  // ✅ 인용구 형식
    }
  ]
}
```

### 올바른 표현
```
"검진 이력이 확인되지 않아, 현재 건강 상태 파악을 위해 검사가 더욱 시급합니다."  // ✅ 적극적
"혈압, 허리둘레, 간기능 수치가 경계 수준으로 확인되어..."  // ✅ 구체적
"대사이상지방간은 간 섬유화로 진행될 수 있어 간 섬유화 스캔을 권장합니다."  // ✅ 논리적 연결
```

---

## 🎯 논리적 추천 이유 작성 구조

모든 추천 항목의 `reason` 필드는 다음 4단계 구조를 따르세요:

1. **현재 상태**: 과거 검진 결과, 문진 내용
2. **위험 요인**: 가족력, 생활습관, 연령
3. **의학적 연결고리**: A → B → C (예: 대사이상 → 지방간 → 섬유화)
4. **추천 검사**: 구체적 검사명

**예시:**
"과거 검진에서 허리둘레가 경계 이상이었고(현재 상태), 가족력으로 당뇨가 확인되었습니다(위험 요인). 복부비만과 당뇨 가족력은 대사이상지방간(MASLD) 위험을 높이며, MASLD는 간 섬유화로 진행될 수 있습니다(연결고리). 따라서 간 섬유화 스캔(VCTE)을 권장합니다(추천 검사)."

---

**중요: 반드시 딕셔너리(객체) 형태의 JSON 형식으로만 응답하세요. 문자열이나 배열이 아닌 JSON 객체 형태로 반환해야 합니다.**
예: {{"patient_summary": "...", "analysis": "...", ...}} 형태

다른 설명이나 주석은 포함하지 마세요.""")
    
    prompt = "\n".join(prompt_parts)
    
    return prompt, structured_evidences
