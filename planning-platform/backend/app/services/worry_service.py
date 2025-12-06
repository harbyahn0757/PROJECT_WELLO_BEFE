from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

class InteractionEvent(BaseModel):
    timestamp: float
    type: str
    questionKey: str
    value: Optional[str] = None
    duration: Optional[float] = None

class UserAttribute(BaseModel):
    target: str
    attribute: str
    level: str
    reason: str

class WorryService:
    def __init__(self):
        # 룰 엔진 초기화 (필요시 DB 로딩 등)
        pass

    def analyze_user_attributes(self, events: List[Dict[str, Any]], survey_responses: Dict[str, Any]) -> List[UserAttribute]:
        """
        이벤트 로그와 설문 응답을 분석하여 사용자 속성을 추출합니다.
        """
        attributes = []
        
        # 1. 설문 응답 기반 분석 (정적 분석)
        attributes.extend(self._analyze_survey_responses(survey_responses))
        
        # 2. 이벤트 로그 기반 분석 (동적 분석)
        if events:
            # 이벤트를 객체로 변환
            event_objects = [InteractionEvent(**e) for e in events]
            attributes.extend(self._analyze_events(event_objects))
            
        return attributes

    def _analyze_survey_responses(self, responses: Dict[str, Any]) -> List[UserAttribute]:
        attrs = []
        
        # 운동 관리 상태
        exercise = responses.get('exercise_frequency', '')
        if exercise == 'regular':
            attrs.append(UserAttribute(
                target='health_management',
                attribute='status',
                level='managing',
                reason='규칙적인 운동 수행'
            ))
        elif exercise in ['rarely', 'never']:
            attrs.append(UserAttribute(
                target='health_management',
                attribute='status',
                level='risk',
                reason='운동 부족'
            ))
            
        # 흡연 상태
        smoking = responses.get('smoking', '')
        if smoking == 'current_smoker':
            attrs.append(UserAttribute(
                target='lifestyle',
                attribute='risk_factor',
                level='high',
                reason='현재 흡연 중'
            ))
        elif smoking == 'ex_smoker':
            attrs.append(UserAttribute(
                target='lifestyle',
                attribute='management_will',
                level='positive',
                reason='금연 성공 (관리 의지 있음)'
            ))
            
        # 자유 텍스트 (가장 높은 진심도)
        concerns = responses.get('additional_concerns', '')
        if concerns and len(concerns.strip()) > 5:
            attrs.append(UserAttribute(
                target='specific_concern',
                attribute='worry_level',
                level='critical',
                reason=f'직접 입력한 걱정: {concerns[:20]}...'
            ))
            
        return attrs

    def _analyze_events(self, events: List[InteractionEvent]) -> List[UserAttribute]:
        attrs = []
        
        # 질문별 체류 시간 및 상호작용 집계
        question_stats = {}
        
        last_enter_time = {}
        
        for event in events:
            key = event.questionKey
            if key not in question_stats:
                question_stats[key] = {
                    'dwell_time': 0,
                    'clicks': 0,
                    'changes': 0,
                    'nav_back': 0
                }
            
            if event.type == 'SLIDE_ENTER':
                last_enter_time[key] = event.timestamp
            elif event.type in ['NAV_NEXT', 'NAV_PREV']:
                # 네비게이션 시 체류 시간 누적
                if key in last_enter_time:
                    duration = event.timestamp - last_enter_time[key]
                    question_stats[key]['dwell_time'] += duration
                    del last_enter_time[key]
                
                if event.type == 'NAV_PREV':
                    question_stats[key]['nav_back'] += 1
            elif event.type == 'OPTION_CLICK':
                question_stats[key]['clicks'] += 1
                question_stats[key]['changes'] += 1
                
        # 규칙 적용
        for key, stats in question_stats.items():
            # Rule 1: Deep Thinker (체류 시간 5초 이상)
            if stats['dwell_time'] > 5000: # 5초
                attrs.append(UserAttribute(
                    target=key,
                    attribute='sincerity',
                    level='high',
                    reason=f'해당 질문에 {stats["dwell_time"]/1000:.1f}초 머무름'
                ))
                
            # Rule 2: Hesitation (잦은 변경/이동)
            if stats['changes'] >= 3 or stats['nav_back'] >= 1:
                attrs.append(UserAttribute(
                    target=key,
                    attribute='decision_state',
                    level='hesitating',
                    reason='답변 번복 또는 이전으로 이동함'
                ))
                
            # Rule 3: Routine Sincerity (일상 생활 질문에 대한 진심도)
            if key == 'daily_routine' and stats['clicks'] > 0:
                # 선택 개수에 따른 로직 추가 가능
                pass
                
        return attrs

worry_service = WorryService()

