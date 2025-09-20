import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// lodash 대신 네이티브 JavaScript 사용
import { 
  IDocumentAnswer, 
  ISubQuestionVisible, 
  initialDocumentAnswer 
} from '../types/questionnaire';

const HealthQuestionnaireComplete: React.FC = () => {
  const navigate = useNavigate();
  const [documentAnswer, setDocumentAnswer] = useState<IDocumentAnswer>(initialDocumentAnswer);
  const [subQuestionVisible, setSubQuestionVisible] = useState<ISubQuestionVisible>({
    disability: false,
    smoking: false,
    drinking: false,
    exercise: false,
    stress: false
  });

  // 현아의 체크박스 이벤트 핸들러 그대로 복사
  const handleCheckboxEvent = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value = '', checked = false, name = '', id = '' }
    } = evt;
    const [category, key] = id.split('_');

    if (checked) {
      const checkboxes = document.getElementsByName(name);
      checkboxes.forEach((checkbox: HTMLElement) => {
        const castingCheckbox = checkbox as HTMLInputElement;
        if (value === 'N' && castingCheckbox.value !== 'N') {
          castingCheckbox.checked = false;
        } else if (value !== 'N' && castingCheckbox.value === 'N') {
          castingCheckbox.checked = false;
        }
      });
    }

    if (key !== 'none') {
      setDocumentAnswer({
        ...documentAnswer,
        ...{ [category]: { ...documentAnswer[category], [key]: checked } }
      });
    } else if (key === 'none' && checked) {
      setDocumentAnswer({
        ...documentAnswer,
        [category]: Object.keys(documentAnswer[category]).reduce(
          (result: any, key: string) => {
            result[key] = false;
            return result;
          },
          { ...documentAnswer[category] }
        )
      });
    }
  };


  const handleInputEvent = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value = 0, name = '' }
    } = evt;
    const [category, key] = name.split('_');
    setDocumentAnswer({
      ...documentAnswer,
      ...{ [category]: { ...documentAnswer[category], [key]: Number(value) } }
    });
  };

  const handleSubQuestion = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const {
      target: { value = '', name = '' }
    } = evt;
    const [category, key] = name.split('_');

    if (key === 'smokingYN') {
      if (value === '1' || value === '2' || value === 'Y') {
        setSubQuestionVisible({ ...subQuestionVisible, smoking: true });
      } else {
        setSubQuestionVisible({ ...subQuestionVisible, smoking: false });
      }
    }

    if (key === 'stressStatusCode') {
      if (['1', '2'].includes(value)) {
        setSubQuestionVisible({ ...subQuestionVisible, stress: true });
      } else {
        setSubQuestionVisible({ ...subQuestionVisible, stress: false });
      }
    }

    if (category === 'livingHabits') {
      setDocumentAnswer({
        ...documentAnswer,
        [category]: Object.keys(documentAnswer[category]).reduce(
          (result: any, key: string) => {
            if (['smokingTotalPeriod', 'smokingAveragePerWeek'].includes(key)) {
              result[key] = 0;
            } else if (key === 'smokingYN') {
              if (['1', '2'].includes(value)) {
                result[key] = true;
              } else {
                result[key] = false;
              }
            } else {
              result[key] = documentAnswer[category][key];
            }
            return result;
          },
          { ...documentAnswer[category] }
        )
      });

      if (key === 'smokingYN') {
        setDocumentAnswer({
          ...documentAnswer,
          [category]: { ...documentAnswer[category], smokingStatus: Number(value) }
        });
      }
    }

    if (category === 'stress') {
      setDocumentAnswer({
        ...documentAnswer,
        [category]: { ...documentAnswer[category], [key]: Number(value) }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 현아의 검증 로직 간소화 버전
    const familyHistory = document.querySelectorAll('[name="familyHistory"]:checked');
    if (familyHistory.length === 0) {
      alert('가족력을 선택해주세요.');
      return;
    }

    const personalHistory = document.querySelectorAll('[name="personalHistory"]:checked');
    if (personalHistory.length === 0) {
      alert('과거력을 선택해주세요.');
      return;
    }

    // 설문 완료 - 결과 페이지로 이동
    console.log('설문 완료:', documentAnswer);
    navigate('/checkup-results');
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="questionnaire-container">
      <div className="container">
        {/* 백 버튼 */}
        <div className="back-button-container">
          <button
            type="button"
            className="back-button"
            onClick={handleBack}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <form name="questionnaireForm" onSubmit={handleSubmit}>
          <div className="wrapper login">
            
            {/* 가족력 섹션 - 현아 구조 그대로 */}
            <div className="question__title">
              <span className="question__title-text--ss">첫번째, 일반정보 중 가족력</span>
              <span className="question__title-text">
                부모님, 형제, 자매 중에
                <br />
                다음 질환을 앓으셨거나
                <br />
                사망한 경우가 있으신가요?
              </span>
            </div>
            <div className="question__content">
              <div className="question__content-input-area" style={{ padding: 0 }}>
                <span className="question__content-input-label">아래 중 해당되는 경우 모두 선택</span>
                <div id="familyHistoryContainer">
                  <label htmlFor="familyHistory_familyCerebralHistory" className="question__content-input-button">
                    <input
                      id="familyHistory_familyCerebralHistory"
                      type="checkbox"
                      name="familyHistory"
                      value="뇌졸중"
                      checked={documentAnswer.familyHistory.familyCerebralHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>뇌졸중</span>
                  </label>
                  <label htmlFor="familyHistory_familyHeartDiseaseHistory" className="question__content-input-button">
                    <input
                      id="familyHistory_familyHeartDiseaseHistory"
                      type="checkbox"
                      name="familyHistory"
                      value="heartDiseaseHistory"
                      checked={documentAnswer.familyHistory.familyHeartDiseaseHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>심근경색/협심증</span>
                  </label>
                  <label htmlFor="familyHistory_familyHypertensionHistory" className="question__content-input-button">
                    <input
                      id="familyHistory_familyHypertensionHistory"
                      type="checkbox"
                      name="familyHistory"
                      value="고혈압"
                      checked={documentAnswer.familyHistory.familyHypertensionHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>고혈압</span>
                  </label>
                  <label htmlFor="familyHistory_familyDiabetesHistory" className="question__content-input-button">
                    <input
                      id="familyHistory_familyDiabetesHistory"
                      type="checkbox"
                      name="familyHistory"
                      value="당뇨병"
                      checked={documentAnswer.familyHistory.familyDiabetesHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>당뇨병</span>
                  </label>
                  <label htmlFor="familyHistory_familyCancerHistory" className="question__content-input-button">
                    <input
                      id="familyHistory_familyCancerHistory"
                      type="checkbox"
                      name="familyHistory"
                      value="암"
                      checked={documentAnswer.familyHistory.familyCancerHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>암</span>
                  </label>
                  <label htmlFor="familyHistory_none" className="question__content-input-button nothing">
                    <input
                      id="familyHistory_none"
                      type="checkbox"
                      name="familyHistory"
                      value="N"
                      onChange={handleCheckboxEvent}
                    />
                    <span>해당없음</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 과거력 섹션 */}
            <div className="question__title">
              <span className="question__title-text--ss">두번째, 일반정보 중 과거력</span>
              <span className="question__title-text">
                회원님께서는 과거에
                <br />
                다음 질환을 앓으셨거나
                <br />
                현재 앓고 계신가요?
              </span>
            </div>
            <div className="question__content">
              <div className="question__content-input-area" style={{ padding: 0 }}>
                <span className="question__content-input-label">아래 중 해당되는 경우 모두 선택</span>
                <div id="personalHistoryContainer">
                  <label htmlFor="personalHistory_personalCerebralHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalCerebralHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="뇌졸중"
                      checked={documentAnswer.personalHistory.personalCerebralHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>뇌졸중</span>
                  </label>
                  <label htmlFor="personalHistory_personalHeartDiseaseHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalHeartDiseaseHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="심근경색/협심증"
                      checked={documentAnswer.personalHistory.personalHeartDiseaseHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>심근경색/협심증</span>
                  </label>
                  <label htmlFor="personalHistory_personalHypertensionHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalHypertensionHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="고혈압"
                      checked={documentAnswer.personalHistory.personalHypertensionHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>고혈압</span>
                  </label>
                  <label htmlFor="personalHistory_personalDiabetesHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalDiabetesHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="당뇨병"
                      checked={documentAnswer.personalHistory.personalDiabetesHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>당뇨병</span>
                  </label>
                  <label htmlFor="personalHistory_personalCancerHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalCancerHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="암"
                      checked={documentAnswer.personalHistory.personalCancerHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>암</span>
                  </label>
                  <label htmlFor="personalHistory_personalKidneyDiseaseHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalKidneyDiseaseHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="신장질환"
                      checked={documentAnswer.personalHistory.personalKidneyDiseaseHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>신장질환</span>
                  </label>
                  <label htmlFor="personalHistory_personalLiverDiseaseHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalLiverDiseaseHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="간질환"
                      checked={documentAnswer.personalHistory.personalLiverDiseaseHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>간질환</span>
                  </label>
                  <label htmlFor="personalHistory_personalThyroidDiseaseHistory" className="question__content-input-button">
                    <input
                      id="personalHistory_personalThyroidDiseaseHistory"
                      type="checkbox"
                      name="personalHistory"
                      value="갑상선질환"
                      checked={documentAnswer.personalHistory.personalThyroidDiseaseHistory}
                      onChange={handleCheckboxEvent}
                    />
                    <span>갑상선질환</span>
                  </label>
                  <label htmlFor="personalHistory_none" className="question__content-input-button nothing">
                    <input
                      id="personalHistory_none"
                      type="checkbox"
                      name="personalHistory"
                      value="N"
                      onChange={handleCheckboxEvent}
                    />
                    <span>해당없음</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 흡연 섹션 */}
            <div className="question__title">
              <span className="question__title-text--ss">세번째, 생활습관 중 흡연</span>
              <span className="question__title-text">
                회원님께서는
                <br />
                담배를 피우시나요?
              </span>
            </div>
            <div className="question__content">
              <div className="question__content-input-area" style={{ padding: 0 }}>
                <div id="livingHabitsSmokingContainer">
                  <label htmlFor="livingHabits_smokingYN_0" className="question__content-input-button">
                    <input
                      id="livingHabits_smokingYN_0"
                      type="radio"
                      name="livingHabits_smokingYN"
                      value="0"
                      onChange={handleSubQuestion}
                    />
                    <span>아니요</span>
                  </label>
                  <label htmlFor="livingHabits_smokingYN_1" className="question__content-input-button">
                    <input
                      id="livingHabits_smokingYN_1"
                      type="radio"
                      name="livingHabits_smokingYN"
                      value="1"
                      onChange={handleSubQuestion}
                    />
                    <span>예, 현재 피웁니다</span>
                  </label>
                  <label htmlFor="livingHabits_smokingYN_2" className="question__content-input-button">
                    <input
                      id="livingHabits_smokingYN_2"
                      type="radio"
                      name="livingHabits_smokingYN"
                      value="2"
                      onChange={handleSubQuestion}
                    />
                    <span>과거에 피웠습니다</span>
                  </label>
                </div>
              </div>
              
              {subQuestionVisible.smoking && (
                <div id="livingHabitsSmokingPeriodContainer">
                  <span className="question__content-input-label">총 흡연기간</span>
                  <input
                    className="question__content-input"
                    type="number"
                    name="livingHabits_smokingTotalPeriod"
                    placeholder="숫자만 입력"
                    onChange={handleInputEvent}
                  />
                  <span className="question__content-input-unit">년</span>
                  
                  <span className="question__content-input-label">하루 평균 흡연량</span>
                  <input
                    className="question__content-input"
                    type="number"
                    name="livingHabits_smokingAveragePerWeek"
                    placeholder="숫자만 입력"
                    onChange={handleInputEvent}
                  />
                  <span className="question__content-input-unit">개비</span>
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="question__footer">
              <button type="submit" className="question__footer-button">
                설문 완료하기
              </button>
              <div className="question__footer__text">
                작성하신 정보는 회원님을 위한 <br />
                건강 관리 및 관련 정보 제공 이외의 목적으로 <br />
                절대 사용되지 않습니다.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HealthQuestionnaireComplete;
