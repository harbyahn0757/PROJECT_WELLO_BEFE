#!/usr/bin/env python3
"""
외부 검사 종류 데이터 입력 스크립트 (초기 데이터 입력용)
제공된 테이블 데이터를 wello_external_checkup_items 테이블에 입력

⚠️ 주의: 이 스크립트는 초기 데이터 입력용입니다.
실제 서비스 코드에서는 데이터베이스에서 직접 조회합니다.
하드코딩된 데이터는 이 스크립트에만 존재하며, 서비스 코드에서는 사용하지 않습니다.
"""
import asyncio
import asyncpg
import json
from typing import List, Dict, Any

DB_CONFIG = {
    "host": "10.0.1.10",
    "port": "5432",
    "database": "p9_mkt_biz",
    "user": "peernine",
    "password": "autumn3334!"
}

# 외부 검사 종류 데이터
EXTERNAL_CHECKUP_ITEMS = [
    # 암 정밀
    {
        "category": "암 정밀",
        "sub_category": "소화기암",
        "item_name": "얼리텍 (대장암)",
        "difficulty_level": "High",
        "target_trigger": "50대 이상, 대장내시경 약 복용 거부감",
        "gap_description": "분변잠혈검사는 정확도가 낮고, 내시경은 준비 과정이 고통스러움",
        "solution_narrative": "분변 속 암세포 DNA만 정밀 분석하여 90% 정확도로 대장암을 찾아냅니다."
    },
    {
        "category": "암 정밀",
        "sub_category": "다중암",
        "item_name": "아이파인더/아이스크린",
        "difficulty_level": "High",
        "target_trigger": "암 가족력, 방사선 피폭 우려, 흡연자",
        "gap_description": "CT/MRI는 방사선 노출이 있고, 아주 작은 초기 암은 놓칠 수 있음",
        "solution_narrative": "혈액 속을 떠다니는 미세 암세포 조각(cfDNA)을 포착해 전신 주요 암 위험을 스캔합니다."
    },
    {
        "category": "암 정밀",
        "sub_category": "여성암",
        "item_name": "마스토체크 (유방암)",
        "difficulty_level": "Mid",
        "target_trigger": "치밀유방 여성, 유방촬영 통증 공포",
        "gap_description": "동양인 여성은 치밀유방이 많아 X-ray만으로는 암을 가려내기 힘듦",
        "solution_narrative": "혈액 내 3가지 단백질 마커를 조합하여 0~1기 초기 유방암 위험도를 알려줍니다."
    },
    {
        "category": "암 정밀",
        "sub_category": "여성암",
        "item_name": "HE4 + ROMA (난소암)",
        "difficulty_level": "Mid",
        "target_trigger": "폐경 전후, 난소암 가족력",
        "gap_description": "기존 CA125 수치는 생리나 염증에도 반응하여 부정확함",
        "solution_narrative": "난소암 특이도가 높은 HE4를 더해 '진짜 암'일 확률(ROMA)을 계산해 드립니다."
    },
    {
        "category": "암 정밀",
        "sub_category": "남성암",
        "item_name": "Pro-PSA (전립선암)",
        "difficulty_level": "Mid",
        "target_trigger": "PSA 수치 경계(4~10), 조직검사 공포",
        "gap_description": "PSA 수치가 조금만 높아도 아픈 조직검사를 해야 하는지 애매함",
        "solution_narrative": "전립선암일 확률을 수치로 계산해, 불필요한 생검(조직검사)을 막아줍니다."
    },
    {
        "category": "암 정밀",
        "sub_category": "유전자",
        "item_name": "암 유전자 패널 (G-Check)",
        "difficulty_level": "High",
        "target_trigger": "암 가족력 다수 보유자",
        "gap_description": "현재 상태만 보는 검사로는 미래의 발병 위험을 알 수 없음",
        "solution_narrative": "부모님께 물려받은 유전적 설계도를 분석해 평생 암 관리 로드맵을 제공합니다."
    },
    # 뇌/신경
    {
        "category": "뇌/신경",
        "sub_category": "치매",
        "item_name": "알츠온/OAβ (아밀로이드)",
        "difficulty_level": "High",
        "target_trigger": "건망증, 50대 이상, 치매 가족력",
        "gap_description": "MRI는 뇌가 위축된 '후'에야 확인 가능 (이미 늦음)",
        "solution_narrative": "증상이 나타나기 15년 전부터 쌓이는 독성 단백질을 혈액으로 미리 감지합니다."
    },
    {
        "category": "뇌/신경",
        "sub_category": "유전자",
        "item_name": "ApoE 유전자형",
        "difficulty_level": "Mid",
        "target_trigger": "젊은 층 치매 예방 관심",
        "gap_description": "생활 습관만으로는 알 수 없는 타고난 위험도가 존재함",
        "solution_narrative": "치매 위험 유전자(ApoE4) 보유 여부를 확인하여 남들보다 더 일찍 관리를 시작하게 돕습니다."
    },
    # 심혈관
    {
        "category": "심혈관",
        "sub_category": "혈관독소",
        "item_name": "호모시스테인",
        "difficulty_level": "Low",
        "target_trigger": "고혈압, 육류 섭취 과다, 음주",
        "gap_description": "콜레스테롤이 정상이어도 혈관이 막히는 원인을 일반 검진에선 모름",
        "solution_narrative": "혈관벽을 긁어 손상을 입히는 '제2의 콜레스테롤' 수치를 확인하고 비타민B로 교정합니다."
    },
    {
        "category": "심혈관",
        "sub_category": "콜레스테롤",
        "item_name": "sdLDL (소입자 LDL)",
        "difficulty_level": "Mid",
        "target_trigger": "고지혈증 약 복용 중, 당뇨",
        "gap_description": "LDL 총량만으로는 혈관 침투력이 강한 '악성' 입자를 구별 못함",
        "solution_narrative": "혈관벽을 파고드는 아주 작고 단단한 '총알' 같은 나쁜 콜레스테롤의 양을 측정합니다."
    },
    {
        "category": "심혈관",
        "sub_category": "유전성",
        "item_name": "Lp(a) 지단백",
        "difficulty_level": "Mid",
        "target_trigger": "젊은 나이 뇌졸중/심근경색 가족력",
        "gap_description": "운동이나 식단으로도 절대 떨어지지 않는 유전적 수치가 있음",
        "solution_narrative": "평생 단 한 번만 검사하면 됩니다. 유전적인 혈관 막힘 위험도를 확인하세요."
    },
    # 기능의학
    {
        "category": "기능의학",
        "sub_category": "만성피로",
        "item_name": "소변 유기산 검사",
        "difficulty_level": "High",
        "target_trigger": "만성피로, 원인 불명 통증, 무기력",
        "gap_description": "혈액검사(간수치 등)는 정상인데 환자는 계속 아픈 경우 원인 미상",
        "solution_narrative": "세포 공장(미토콘드리아)이 제대로 돌아가는지 대사 산물 70종을 분석해 원인을 찾습니다."
    },
    {
        "category": "기능의학",
        "sub_category": "알러지",
        "item_name": "지연성 알러지 (IgG)",
        "difficulty_level": "High",
        "target_trigger": "만성 소화불량, 여드름, 두통",
        "gap_description": "일반 알러지 검사는 먹고 바로 붓는 급성만 확인 가능",
        "solution_narrative": "즐겨 먹는 우유나 밀가루가 며칠 뒤 내 몸에 염증을 일으키는지 '숨은 범인'을 찾습니다."
    },
    {
        "category": "기능의학",
        "sub_category": "장건강",
        "item_name": "마이크로바이옴",
        "difficulty_level": "High",
        "target_trigger": "비만, 과민성 대장, 잦은 가스",
        "gap_description": "내시경은 모양만 볼 뿐, 장 속 환경(세균 생태계)은 보지 못함",
        "solution_narrative": "내 장 속에 비만균(뚱보균)이 많은지, 유익균이 잘 살고 있는지 지도로 보여줍니다."
    },
    {
        "category": "기능의학",
        "sub_category": "장건강",
        "item_name": "조눌린 (장누수)",
        "difficulty_level": "Mid",
        "target_trigger": "복부 팽만, 전신 염증, 자가면역",
        "gap_description": "장 점막이 느슨해져 독소가 침투하는지 일반 검사론 확인 불가",
        "solution_narrative": "장 세포 결합이 헐거워져 독소가 새어 들어오는 '장 누수 증후군' 여부를 확인합니다."
    },
    {
        "category": "기능의학",
        "sub_category": "영양/독소",
        "item_name": "모발 미네랄 검사",
        "difficulty_level": "Mid",
        "target_trigger": "탈모, 참치/연어 선호, 편식 아동",
        "gap_description": "혈액은 항상성을 유지해 만성 결핍이나 중금속 축적을 숨김",
        "solution_narrative": "머리카락은 지난 3개월간 당신 몸의 영양 불균형과 중금속 역사를 기록한 블랙박스입니다."
    },
    # 면역/항노화
    {
        "category": "면역/항노화",
        "sub_category": "면역력",
        "item_name": "NK세포 활성도",
        "difficulty_level": "Mid",
        "target_trigger": "대상포진 경험, 잦은 감기, 암 걱정",
        "gap_description": "백혈구 숫자만으로는 바이러스와 싸울 '능력'이 있는지 모름",
        "solution_narrative": "내 면역세포가 암세포를 공격할 힘(활성도)이 얼마나 되는지 점수로 보여줍니다."
    },
    {
        "category": "면역/항노화",
        "sub_category": "노화",
        "item_name": "텔로미어 (신체나이)",
        "difficulty_level": "Mid",
        "target_trigger": "건강관리 고관여층, 웰니스족",
        "gap_description": "주민등록 나이와 실제 신체 노화 속도는 다름",
        "solution_narrative": "염색체 끝 길이를 측정해 당신의 '생물학적 수명 시계'가 얼마나 빨리 가는지 알려줍니다."
    },
    {
        "category": "면역/항노화",
        "sub_category": "활성산소",
        "item_name": "활성산소/항산화력",
        "difficulty_level": "Low",
        "target_trigger": "흡연자, 과도한 스트레스",
        "gap_description": "몸이 얼마나 녹슬고 있는지(산화) 일반 검진에선 알 수 없음",
        "solution_narrative": "노화의 주범인 활성산소 수치와 이를 방어하는 항산화 능력을 비교해 드립니다."
    },
    # 호르몬
    {
        "category": "호르몬",
        "sub_category": "스트레스",
        "item_name": "타액 호르몬 (Cortisol)",
        "difficulty_level": "Mid",
        "target_trigger": "번아웃, 아침 기상 곤란, 수면장애",
        "gap_description": "채혈 한 번으로는 하루 종일 변하는 호르몬 리듬을 못 봄",
        "solution_narrative": "하루 4번 타액을 채취해 부신(에너지 배터리) 기능이 고장 났는지 패턴을 분석합니다."
    },
    {
        "category": "호르몬",
        "sub_category": "갱년기(여)",
        "item_name": "AMH (난소 나이)",
        "difficulty_level": "Low",
        "target_trigger": "3040 여성, 임신 준비, 조기폐경 걱정",
        "gap_description": "생리 불순만으로는 난소의 남은 기능을 정확히 알기 어려움",
        "solution_narrative": "난소에 난자가 얼마나 남았는지 측정해 폐경 시기를 예측하고 인생 계획을 돕습니다."
    },
    {
        "category": "호르몬",
        "sub_category": "갱년기(남)",
        "item_name": "남성호르몬 (Free T)",
        "difficulty_level": "Low",
        "target_trigger": "성욕 감퇴, 근력 저하, 무기력",
        "gap_description": "총 테스토스테론 양보다 실제 쓰이는 양이 중요함",
        "solution_narrative": "실제 몸에서 활약하는 '유리' 호르몬을 측정해 남성 갱년기를 정확히 진단합니다."
    },
    {
        "category": "호르몬",
        "sub_category": "탈모",
        "item_name": "DHT (탈모호르몬)",
        "difficulty_level": "Low",
        "target_trigger": "탈모 진행 중, 가족력",
        "gap_description": "겉으로 보이는 증상만으로는 약물 치료 시기를 잡기 어려움",
        "solution_narrative": "남성형 탈모의 주범인 DHT 수치를 확인해 약물 치료의 필요성을 의학적으로 판단합니다."
    },
    # 소화기
    {
        "category": "소화기",
        "sub_category": "위장",
        "item_name": "펩시노겐 (PG I/II)",
        "difficulty_level": "Low",
        "target_trigger": "위내시경 공포증, 소화불량",
        "gap_description": "내시경 없이 위 점막 상태를 알고 싶어 함",
        "solution_narrative": "혈액으로 위 점막이 얇아진 상태(위축성 위염)를 파악해 위암 위험군을 선별합니다."
    },
    {
        "category": "소화기",
        "sub_category": "헬리코박터",
        "item_name": "헬리코박터 (혈액/대변)",
        "difficulty_level": "Low",
        "target_trigger": "가족 간 감염 우려, 속쓰림",
        "gap_description": "내시경 시 조직검사를 못 했거나, 호기검사가 번거로울 때",
        "solution_narrative": "간단한 채혈이나 대변으로 위암 1급 발암인자인 헬리코박터균 감염 여부를 확인합니다."
    },
    # 영양
    {
        "category": "영양",
        "sub_category": "필수",
        "item_name": "비타민 D",
        "difficulty_level": "Low",
        "target_trigger": "실내 근무자, 골다공증 우려",
        "gap_description": "한국인 90% 결핍. 수치를 모르면 영양제를 얼마나 먹을지 모름",
        "solution_narrative": "면역력과 뼈 건강의 기본인 비타민 D 농도를 확인해 적정 섭취량을 가이드합니다."
    },
    {
        "category": "영양",
        "sub_category": "필수",
        "item_name": "오메가-3 인덱스",
        "difficulty_level": "Mid",
        "target_trigger": "오메가3 복용자, 심혈관 우려",
        "gap_description": "내가 먹는 영양제가 실제 몸에 흡수되어 효과를 내는지 모름",
        "solution_narrative": "적혈구 막의 오메가3 비율을 분석해 심장 보호 효과가 충분한지 검증해 드립니다."
    },
    # 감염
    {
        "category": "감염",
        "sub_category": "바이러스",
        "item_name": "HPV 유전형 (Genotyping)",
        "difficulty_level": "Low",
        "target_trigger": "결혼 전 예비부부, 파트너 변경",
        "gap_description": "단순 양성/음성만으로는 자궁경부암 위험도를 모름",
        "solution_narrative": "암을 일으키는 고위험군 바이러스(16, 18번 등)인지 정확한 번호를 식별합니다."
    },
    {
        "category": "감염",
        "sub_category": "바이러스",
        "item_name": "잠복결핵 (IGRA)",
        "difficulty_level": "Low",
        "target_trigger": "기숙사/단체생활, 해외유학",
        "gap_description": "피부 검사는 위양성이 많고 번거로움",
        "solution_narrative": "몸속에 숨죽이고 있는 결핵균을 혈액으로 정확히 찾아내 면역 저하 시 발병을 막습니다."
    },
    # 기타
    {
        "category": "기타",
        "sub_category": "알코올",
        "item_name": "ALDH2 유전자",
        "difficulty_level": "Low",
        "target_trigger": "술 마시면 얼굴 빨개지는 사람",
        "gap_description": "본인의 알코올 해독 능력을 과신하여 과음함",
        "solution_narrative": "아세트알데히드 분해 능력을 확인해, 음주로 인한 식도암/위암 위험도를 경고합니다."
    },
    # 영상의학
    {
        "category": "영상의학",
        "sub_category": "뇌",
        "item_name": "뇌 MRA (혈관)",
        "difficulty_level": "High",
        "target_trigger": "편두통, 고혈압, 뇌졸중 가족력",
        "gap_description": "CT나 MRI(뇌 실질)로는 혈관의 꽈리(동맥류)를 못 봄",
        "solution_narrative": "뇌 혈관만 입체적으로 촬영하여, 터지기 전의 시한폭탄(뇌동맥류)을 찾아냅니다."
    },
    {
        "category": "영상의학",
        "sub_category": "폐",
        "item_name": "저선량 폐 CT",
        "difficulty_level": "Mid",
        "target_trigger": "10년 이상 흡연, 간접흡연 노출",
        "gap_description": "X-ray로는 심장 뒤에 숨은 암이나 초기 폐암 결절 안 보임",
        "solution_narrative": "방사선량을 1/5로 줄여 안전하게, X-ray 사각지대의 초기 폐암을 발견합니다."
    },
    {
        "category": "영상의학",
        "sub_category": "복부",
        "item_name": "복부 조영 CT",
        "difficulty_level": "Mid",
        "target_trigger": "복부비만, 췌장암 가족력",
        "gap_description": "초음파는 가스 때문에 췌장/담낭을 놓치기 쉬움",
        "solution_narrative": "췌장, 담낭, 간, 신장 등 복부 장기의 미세한 병변을 한 번에 정밀 촬영합니다."
    },
    {
        "category": "영상의학",
        "sub_category": "심장",
        "item_name": "관상동맥 석회화 CT",
        "difficulty_level": "Mid",
        "target_trigger": "고지혈증, 흉통, 중년 남성",
        "gap_description": "혈액검사나 심전도만으로는 혈관이 얼마나 딱딱한지 모름",
        "solution_narrative": "심장 혈관에 쌓인 칼슘(석회) 양을 측정해 향후 10년 내 심장마비 위험을 예측합니다."
    },
    {
        "category": "영상의학",
        "sub_category": "척추",
        "item_name": "요추/경추 MRI",
        "difficulty_level": "High",
        "target_trigger": "디스크 증상, 만성 요통",
        "gap_description": "X-ray는 뼈만 보이고 신경/디스크 상태는 확인 불가",
        "solution_narrative": "신경이 눌리는 정도와 디스크 탈출 여부를 정확히 진단해 치료 방향을 결정합니다."
    },
    # 내시경
    {
        "category": "내시경",
        "sub_category": "소화기",
        "item_name": "수면 대장내시경",
        "difficulty_level": "Mid",
        "target_trigger": "40대 이상, 용종 이력, 혈변",
        "gap_description": "분변검사나 CT로는 작은 용종을 제거할 수 없음",
        "solution_narrative": "검사와 동시에 암이 될 수 있는 용종을 즉시 떼어내는 가장 확실한 예방책입니다."
    }
]

async def insert_external_checkup_items():
    """외부 검사 종류 데이터 입력"""
    conn = None
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        
        print("=" * 80)
        print("외부 검사 종류 데이터 입력 시작")
        print("=" * 80)
        
        inserted_count = 0
        skipped_count = 0
        
        for item in EXTERNAL_CHECKUP_ITEMS:
            try:
                # 중복 체크
                existing = await conn.fetchrow(
                    "SELECT id FROM wello.wello_external_checkup_items WHERE item_name = $1",
                    item["item_name"]
                )
                
                if existing:
                    print(f"⏭️  건너뜀: {item['item_name']} (이미 존재)")
                    skipped_count += 1
                    continue
                
                # 데이터 입력
                await conn.execute("""
                    INSERT INTO wello.wello_external_checkup_items 
                    (category, sub_category, item_name, difficulty_level, target_trigger, gap_description, solution_narrative, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                    item["category"],
                    item["sub_category"],
                    item["item_name"],
                    item["difficulty_level"],
                    item["target_trigger"],
                    item["gap_description"],
                    item["solution_narrative"],
                    True
                )
                
                inserted_count += 1
                print(f"✅ 입력 완료: {item['item_name']} ({item['category']} - {item['sub_category']})")
                
            except Exception as e:
                print(f"❌ 오류 발생 ({item['item_name']}): {e}")
        
        print("\n" + "=" * 80)
        print(f"입력 완료: {inserted_count}개, 건너뜀: {skipped_count}개")
        print("=" * 80)
        
        # 통계 출력
        stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE difficulty_level = 'Low') as low_count,
                COUNT(*) FILTER (WHERE difficulty_level = 'Mid') as mid_count,
                COUNT(*) FILTER (WHERE difficulty_level = 'High') as high_count
            FROM wello.wello_external_checkup_items
            WHERE is_active = true
        """)
        
        print(f"\n📊 통계:")
        print(f"  전체: {stats['total']}개")
        print(f"  Low (부담없는): {stats['low_count']}개")
        print(f"  Mid (추천): {stats['mid_count']}개")
        print(f"  High (프리미엄): {stats['high_count']}개")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(insert_external_checkup_items())

