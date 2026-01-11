#!/usr/bin/env python3
"""
엘라마클라우드 인덱싱용 검사 항목 데이터셋 생성
데이터베이스에서 검사 항목을 조회하고, 제공된 정보와 매칭하여 구조화된 JSON 생성
"""
import asyncio
import asyncpg
import json
from typing import Dict, Any, List
from datetime import datetime

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 제공된 정보 기반 검사별 상세 데이터 매핑
ENHANCED_DATA = {
    "얼리텍 대장암 검사(EarlyTect-C)": {
        "sensitivity": 90.2,
        "specificity": 90.2,
        "early_stage_sensitivity": 89.1,
        "sample_size": 585,
        "study_design": "확증 임상",
        "platform_detail": "메틸화 SDC2 표지자 기반 실시간 PCR",
        "biomarker_type": "DNA 메틸화",
        "icd_codes": ["C18", "C19", "C20"],
        "clinical_use_cases": ["스크리닝", "조기검진"],
        "clinical_summary": "확증 임상 585명에서 대장암 민감도 90.2%, 특이도 90.2%, 0-2기 민감도 89.1%를 보였다. 무증상·고위험군 대장암 비침습 스크리닝에 적합하며, 내시경 전 필터링 용도로 활용 가능하다.",
        "reference_urls": [
            "https://www.bigdata-cancer.kr/ncc/clinicalLibraryInfo.do"
        ]
    },
    "얼리텍 방광암 검사(EarlyTect-B)": {
        "sensitivity": 84.0,
        "specificity": 94.0,
        "early_stage_sensitivity": 74.0,
        "sample_size": 574,
        "study_design": "탐색 임상",
        "platform_detail": "PENK 메틸화 기반 실시간 PCR",
        "biomarker_type": "DNA 메틸화",
        "icd_codes": ["C67"],
        "clinical_use_cases": ["스크리닝", "진단 보조"],
        "clinical_summary": "탐색 임상 574명에서 방광암 민감도 84.0%, 특이도 94.0%, 조기 pTa 방광암 민감도 74.0%를 보였다. 국제 공동 전향 연구에서는 전체 민감도 81.0%, NPV 97.7%를 보고했다. 혈뇨 환자에서 방광암 조기검출 및 방광내시경 전 선별검사로 활용 가능하다.",
        "reference_urls": []
    },
    "얼리텍 폐암 검사(EarlyTect-L)": {
        "sensitivity": 77.8,
        "specificity": 92.3,
        "early_stage_sensitivity": 62.2,
        "sample_size": None,
        "study_design": "확증 임상",
        "platform_detail": "PCDHGA12 메틸화 기반 액체생검",
        "biomarker_type": "DNA 메틸화",
        "icd_codes": ["C34"],
        "clinical_use_cases": ["진단 보조", "조기검진"],
        "clinical_summary": "확증 임상에서 폐암 민감도 77.8%, 특이도 92.3%, 조기(I-II기) 민감도 62.2%를 보였다. 파일럿 연구에서 민감도 75.0%, 특이도 78.9%, 기관지내시경과 병행 시 민감도 83.3%를 보고했다. 고위험군 폐결절 환자에서 기관지내시경 보조 및 조기폐암 선별에 활용 가능하다.",
        "reference_urls": []
    },
    "마스토체크(MASTOCHECK)": {
        "sensitivity": None,
        "specificity": None,
        "auc_score": 0.83,
        "sample_size": None,
        "study_design": "국내 임상",
        "platform_detail": "3종 단백질 바이오마커 다중분석(LC-MS/MS) 기반 알고리즘",
        "biomarker_type": "단백질",
        "icd_codes": ["C50"],
        "clinical_use_cases": ["스크리닝", "조기검진"],
        "clinical_summary": "국내 임상에서 조기(0-2기) 유방암 선별 정확도 ROC AUC 약 0.83을 보였다. 일부 연구에서 90%대 초반 정확도를 보고했다. 유방촬영술 보완 혈액검사로 0-2기 조기 유방암 스크리닝에 활용 가능하다.",
        "reference_urls": []
    },
    "헤포덱트(HEPOtect)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "멀티바이오마커 기반 혈액검사",
        "biomarker_type": "액체생검/단백질 조합",
        "icd_codes": ["C22"],
        "clinical_use_cases": ["스크리닝", "조기검진"],
        "clinical_summary": "B형·C형 간염·간경변 고위험군에서 간세포암(HCC) 조기검진 보조 검사로 활용된다. 다중 표지자 혈액검사로 조기 HCC에서 단일 AFP보다 높은 민감도를 보인다고 보고되었다.",
        "reference_urls": []
    },
    "아이캔서치(ai-CANCERCH)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "cfDNA/ctDNA, 메틸화, 단백질/대사체를 AI 알고리즘으로 통합 분석",
        "biomarker_type": "다중 바이오마커",
        "icd_codes": ["C34", "C22", "C16", "C18", "C25", "C50"],
        "clinical_use_cases": ["스크리닝", "다중암 선별"],
        "secondary_cancer_types": ["폐암", "간암", "대장암", "췌장암", "위암", "유방암"],
        "clinical_summary": "한 번의 채혈로 다중암 6-10종(폐/간/대장/췌장 등)을 선별할 수 있는 액체생검 플랫폼이다. 건강검진센터용 혈액 기반 다중암 위험도 평가 패널로 활용되며, 조기암/재발 모니터링에 적합하다.",
        "reference_urls": []
    },
    "온코캐치-E(OncoCatch-E)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "액체생검 기반 다중암 선별",
        "biomarker_type": "ctDNA",
        "icd_codes": ["C18", "C34", "C16", "C50"],
        "clinical_use_cases": ["스크리닝", "다중암 선별"],
        "secondary_cancer_types": ["대장암", "폐암", "위암", "유방암"],
        "clinical_summary": "초기(1기) 암 발견 및 발생 위치 추적이 가능한 프리미엄 검진 옵션이다. 다중암 10종(대장/폐/위/유방 등)을 한 번의 검사로 선별할 수 있다.",
        "reference_urls": []
    },
    "아이파인더(i-FINDER)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "액체생검 기반 암 위험도 예측",
        "biomarker_type": "다중 바이오마커",
        "icd_codes": ["C34", "C22", "C16", "C18"],
        "clinical_use_cases": ["위험도 예측", "스크리닝"],
        "secondary_cancer_types": ["폐암", "간암", "위암", "대장암"],
        "clinical_summary": "저렴한 비용으로 현재 암 위험 수치(%)를 확인할 수 있는 검사이다. 일반 채혈 시 간편하게 추가할 수 있어 건강검진센터에서 활용도가 높다. 8대 암(폐/간/위/대장 등)의 위험도를 평가한다.",
        "reference_urls": []
    },
    "캔서 리스크 스크린(Cancer Risk Screen)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "유전체 분석 기반",
        "biomarker_type": "유전자 변이",
        "icd_codes": ["C00-C97"],
        "clinical_use_cases": ["위험도 예측", "유전적 소인 분석"],
        "clinical_summary": "유전성 암(브라카 변이 등) 유무를 확인하고, 암 발병 전 예방적 검사가 가능한 유전적 소인 분석 검사이다. 주요 고형암에 대한 위험도를 평가한다.",
        "reference_urls": []
    },
    "제노팩 캔서(GenoPac)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "유전체 분석 기반",
        "biomarker_type": "유전자 변이",
        "icd_codes": ["C00-C97"],
        "clinical_use_cases": ["위험도 예측", "유전적 소인 분석"],
        "clinical_summary": "가족력이 있어 타고난 암 취약성을 확인하고, 생활습관 교정 등 예방 관리 목적으로 활용되는 유전적 소인 분석 검사이다. 주요 암종 소인을 평가한다.",
        "reference_urls": []
    },
    "스마트 바이옵시(Smart Biopsy)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "AI·영상 기반 진단 보조",
        "biomarker_type": "AI-영상분석",
        "icd_codes": ["C61", "C50"],
        "clinical_use_cases": ["진단 보조", "전이/재발 확인"],
        "clinical_summary": "이미 암 진단을 받은 환자에서 조직검사가 불가능한 위치의 전이암 확인에 활용된다. AI 기반 영상 분석으로 수 분 내 판독이 가능하며, 암 여부·병기 분류 정확도를 향상시킨다.",
        "reference_urls": []
    },
    "온코아큐패널 등": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": 100000,
        "study_design": "분석 성능 검증 연구",
        "platform_detail": "NGS 기반 종양 유전체 패널(300여 유전자, MSI/TMB 포함)",
        "biomarker_type": "DNA 변이",
        "icd_codes": ["C50", "C56"],
        "clinical_use_cases": ["동반진단", "정밀의료"],
        "secondary_cancer_types": ["유방암", "난소암"],
        "panel_scope": {
            "gene_count": 300,
            "variant_types": ["SNV", "Indel", "CNV", "MSI", "TMB"]
        },
        "clinical_summary": "분석 성능 검증 연구에서 임상 샘플 100,000건 이상을 사용했으며, ≥10% VAF에서 변이 검출이 가능하고 평균 온타깃 커버리지 300배 이상을 보인다. 유방암/난소암 확진자 및 가족에서 안젤리나 졸리 유전자(BRCA) 정밀 분석에 활용된다.",
        "reference_urls": []
    },
    "PNAClamp 등": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "PNA 클램핑 실시간 PCR",
        "biomarker_type": "DNA 변이",
        "icd_codes": ["C34", "C18"],
        "clinical_use_cases": ["동반진단", "표적치료제 매칭"],
        "secondary_cancer_types": ["폐암", "대장암"],
        "clinical_summary": "PNA 클램핑 실시간 PCR로 소량 변이 DNA를 고감도로 검출한다. EGFR 변이를 약 1% 수준의 낮은 변이율까지 검출 가능하며, 직선염기서열보다 높은 민감도를 보인다. 폐암/대장암에서 EGFR, KRAS 등 표적유전자 변이 진단 및 표적치료제 선택에 활용된다.",
        "reference_urls": []
    },
    "H.pylori 검사(Allplex H.pylori)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "실시간 PCR 기반 다중 감염 패널",
        "biomarker_type": "바이러스 DNA",
        "icd_codes": ["C16"],
        "clinical_use_cases": ["감염진단", "예방"],
        "clinical_summary": "위·십이지장 궤양·위암 위험인자 H. pylori를 분자진단 수준으로 검출한다. 헬리코박터 감염 진단 및 제균치료 전·후 확인에 활용되며, 위암 고위험군 관리에 적합하다.",
        "reference_urls": []
    },
    "HPV 검사(Allplex HPV)": {
        "sensitivity": None,
        "specificity": None,
        "sample_size": None,
        "study_design": None,
        "platform_detail": "실시간 PCR 기반 다중 감염 패널",
        "biomarker_type": "바이러스 DNA",
        "icd_codes": ["C53"],
        "clinical_use_cases": ["감염진단", "예방", "스크리닝"],
        "clinical_summary": "고위험·저위험 HPV 유전자형을 동시 검출하는 실시간 PCR 기반 패널이다. 자궁경부암 선행병변 검출을 위한 고위험 HPV 감염 진단에 사용되며, 세포검사보다 높은 바이러스 검출 민감도를 보인다. 자궁경부암 스크리닝 및 추적, 백신 효과 평가에 활용된다.",
        "reference_urls": []
    }
}

# 참고 자료 URL (공통)
COMMON_REFERENCE_URLS = [
    "https://www.data.go.kr/data/15072697/fileData.do",
    "https://www.bigdata-cancer.kr/ncc/clinicalLibraryInfo.do",
    "https://scienceon.kisti.re.kr/srch/selectPORSrchReport.do?cn=TRKO202000003500",
    "https://www.mohw.go.kr/boardDownload.es?bid=0003&list_no=1485397&seq=6",
    "https://www.bics.re.kr/tech/techYear?emergingTechSn=342"
]

async def generate_elama_cloud_dataset():
    """엘라마클라우드 인덱싱용 데이터셋 생성"""
    
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 100)
        print("엘라마클라우드 인덱싱용 검사 항목 데이터셋 생성")
        print("=" * 100)
        
        # 데이터베이스에서 검사 항목 조회
        items = await conn.fetch("""
            SELECT 
                id,
                category,
                sub_category,
                item_name,
                item_name_en,
                difficulty_level,
                target_trigger,
                gap_description,
                solution_narrative,
                description,
                manufacturer,
                target,
                input_sample,
                algorithm_class,
                is_active,
                created_at,
                updated_at
            FROM welno.welno_external_checkup_items
            WHERE is_active = true
            ORDER BY id
        """)
        
        if not items:
            print("\n⚠️  검사 항목이 없습니다.\n")
            return
        
        print(f"\n총 {len(items)}개 항목 처리 중...\n")
        
        # 엘라마클라우드 인덱싱용 JSON 문서 생성
        documents = []
        
        for item in items:
            item_name = item.get('item_name', '')
            enhanced = ENHANCED_DATA.get(item_name, {})
            
            # 기본 정보
            doc = {
                "id": f"checkup_item_{item.get('id')}",
                "db_id": item.get('id'),
                
                # 식별/기본 정보
                "test_name_ko": item_name,
                "test_name_en": item.get('item_name_en') or enhanced.get('test_name_en'),
                "brand_family": enhanced.get('brand_family') or item_name.split('(')[0].strip() if '(' in item_name else None,
                "company_name": item.get('manufacturer') or enhanced.get('company_name'),
                "category_main": item.get('category'),
                "category_sub": item.get('sub_category'),
                
                # 임상/질환 정보
                "primary_cancer_type": item.get('target') or enhanced.get('primary_cancer_type'),
                "secondary_cancer_types": enhanced.get('secondary_cancer_types', []),
                "icd_codes": enhanced.get('icd_codes', []),
                "clinical_use_cases": enhanced.get('clinical_use_cases', []),
                "target_population": item.get('target_trigger') or enhanced.get('target_population'),
                
                # 기술/검체 정보
                "specimen_type": item.get('input_sample') or enhanced.get('specimen_type'),
                "platform": enhanced.get('platform_detail') or item.get('algorithm_class'),
                "biomarker_type": enhanced.get('biomarker_type'),
                "panel_scope": enhanced.get('panel_scope'),
                
                # 성능/근거 정보
                "key_metrics": {
                    "sensitivity": enhanced.get('sensitivity'),
                    "specificity": enhanced.get('specificity'),
                    "auc_score": enhanced.get('auc_score'),
                    "ppv": enhanced.get('ppv'),
                    "npv": enhanced.get('npv'),
                    "early_stage_sensitivity": enhanced.get('early_stage_sensitivity'),
                    "early_stage_specificity": enhanced.get('early_stage_specificity')
                },
                "study_design": enhanced.get('study_design'),
                "sample_size": enhanced.get('sample_size'),
                "study_type": enhanced.get('study_type'),
                "publication_refs": enhanced.get('publication_refs', []),
                
                # 규제/실무 정보
                "mfds_approval": enhanced.get('mfds_approval', False),
                "mfds_approval_number": enhanced.get('mfds_approval_number'),
                "reimbursement_status": enhanced.get('reimbursement_status', '비급여'),
                "clinical_setting": enhanced.get('clinical_setting', ['검진센터', '대학병원']),
                
                # 비즈니스 정보
                "difficulty_level": item.get('difficulty_level'),
                "difficulty_label": {
                    'Low': '부담없는',
                    'Mid': '추천',
                    'High': '프리미엄'
                }.get(item.get('difficulty_level'), ''),
                "target_trigger": item.get('target_trigger'),
                "gap_description": item.get('gap_description'),
                "solution_narrative": item.get('solution_narrative'),
                
                # 벡터 임베딩용 텍스트 필드
                "short_description_ko": enhanced.get('clinical_summary') or item.get('description') or f"{item_name}은(는) {item.get('category')} 카테고리의 {item.get('sub_category')} 검사입니다.",
                "short_description_en": enhanced.get('short_description_en'),
                "clinical_summary": enhanced.get('clinical_summary') or item.get('description'),
                "guideline_context": enhanced.get('guideline_context'),
                
                # 참고 자료
                "reference_urls": enhanced.get('reference_urls', []) + COMMON_REFERENCE_URLS,
                
                # 메타데이터
                "is_active": item.get('is_active'),
                "created_at": item.get('created_at').isoformat() if item.get('created_at') else None,
                "updated_at": item.get('updated_at').isoformat() if item.get('updated_at') else None,
                "indexed_at": datetime.now().isoformat()
            }
            
            # 벡터 임베딩용 통합 텍스트 생성
            embedding_text_parts = [
                doc['test_name_ko'],
                doc['category_main'],
                doc['category_sub'],
                doc['primary_cancer_type'],
                doc['short_description_ko'],
                doc['clinical_summary']
            ]
            if doc['secondary_cancer_types']:
                embedding_text_parts.append(f"대상 암종: {', '.join(doc['secondary_cancer_types'])}")
            if doc['target_population']:
                embedding_text_parts.append(f"추천 대상: {doc['target_population']}")
            if doc['platform']:
                embedding_text_parts.append(f"기술: {doc['platform']}")
            if doc['biomarker_type']:
                embedding_text_parts.append(f"바이오마커: {doc['biomarker_type']}")
            
            doc["embedding_text"] = " ".join(filter(None, embedding_text_parts))
            
            documents.append(doc)
        
        # JSON 파일로 저장
        import os
        output_dir = "/home/workspace/PROJECT_WELLO_BEFE/planning-platform/backend/data"
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, "external_checkup_items_elama_cloud.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(documents, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 총 {len(documents)}개 문서 생성 완료")
        print(f"📁 저장 위치: {output_file}\n")
        
        # 샘플 출력
        if documents:
            print("=" * 100)
            print("샘플 문서 (첫 번째 항목)")
            print("=" * 100)
            print(json.dumps(documents[0], ensure_ascii=False, indent=2))
            print("\n")
        
        # 통계 출력
        print("=" * 100)
        print("데이터셋 통계")
        print("=" * 100)
        
        categories = {}
        difficulty_levels = {}
        use_cases = {}
        
        for doc in documents:
            cat = doc.get('category_main', '미분류')
            categories[cat] = categories.get(cat, 0) + 1
            
            diff = doc.get('difficulty_level', 'Unknown')
            difficulty_levels[diff] = difficulty_levels.get(diff, 0) + 1
            
            for uc in doc.get('clinical_use_cases', []):
                use_cases[uc] = use_cases.get(uc, 0) + 1
        
        print(f"\n총 문서 수: {len(documents)}개")
        print(f"\n카테고리별:")
        for cat, count in sorted(categories.items()):
            print(f"  - {cat}: {count}개")
        
        print(f"\n난이도별:")
        for diff, count in sorted(difficulty_levels.items()):
            print(f"  - {diff}: {count}개")
        
        print(f"\n임상 용도별:")
        for uc, count in sorted(use_cases.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {uc}: {count}개")
        
        print("\n" + "=" * 100)
        print("엘라마클라우드 인덱싱 가이드")
        print("=" * 100)
        print("""
1. 인덱스 생성:
   - 인덱스명: external_checkup_items
   - 벡터 필드: embedding_text (텍스트 임베딩용)

2. 필드 매핑:
   - keyword: id, db_id, test_name_ko, category_main, difficulty_level
   - text: short_description_ko, clinical_summary, embedding_text
   - nested: key_metrics, secondary_cancer_types, clinical_use_cases
   - date: created_at, updated_at, indexed_at

3. 검색 필드:
   - 기본 검색: embedding_text (벡터 유사도 검색)
   - 필터링: category_main, difficulty_level, primary_cancer_type
   - 정렬: difficulty_level, sample_size
        """)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(generate_elama_cloud_dataset())

