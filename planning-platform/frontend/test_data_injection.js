/**
 * 종합 분석 기능 테스트를 위한 Mock 데이터 주입 스크립트
 * 브라우저 개발자 도구 콘솔에서 실행하세요
 */

// 테스트용 건강검진 데이터
const mockHealthData = {
  ResultList: [
    {
      Year: "2024",
      CheckUpDate: "2024-10-15",
      Inspections: [
        {
          Name: "계측검사",
          Illnesses: [
            {
              Items: [
                { Name: "신장", Value: "175", Unit: "cm" },
                { Name: "체중", Value: "70", Unit: "kg" },
                { Name: "체질량지수", Value: "22.9", Unit: "kg/m²" }
              ]
            }
          ]
        },
        {
          Name: "혈액검사",
          Illnesses: [
            {
              Items: [
                { Name: "공복혈당", Value: "95", Unit: "mg/dL" },
                { Name: "총콜레스테롤", Value: "210", Unit: "mg/dL" },
                { Name: "고밀도(HDL) 콜레스테롤", Value: "45", Unit: "mg/dL" },
                { Name: "저밀도(LDL) 콜레스테롤", Value: "130", Unit: "mg/dL" },
                { Name: "중성지방", Value: "150", Unit: "mg/dL" }
              ]
            }
          ]
        }
      ]
    },
    {
      Year: "2023",
      CheckUpDate: "2023-09-20",
      Inspections: [
        {
          Name: "계측검사",
          Illnesses: [
            {
              Items: [
                { Name: "신장", Value: "175", Unit: "cm" },
                { Name: "체중", Value: "72", Unit: "kg" },
                { Name: "체질량지수", Value: "23.5", Unit: "kg/m²" }
              ]
            }
          ]
        },
        {
          Name: "혈액검사",
          Illnesses: [
            {
              Items: [
                { Name: "공복혈당", Value: "88", Unit: "mg/dL" },
                { Name: "총콜레스테롤", Value: "195", Unit: "mg/dL" },
                { Name: "고밀도(HDL) 콜레스테롤", Value: "48", Unit: "mg/dL" },
                { Name: "저밀도(LDL) 콜레스테롤", Value: "120", Unit: "mg/dL" },
                { Name: "중성지방", Value: "135", Unit: "mg/dL" }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// 테스트용 처방전 데이터 (최근 3개월)
const mockPrescriptionData = {
  ResultList: [
    {
      JinRyoGaesiIl: "2024-09-15",
      ByungEuiwonYakGukMyung: "김현우내과의원",
      Address: "서울시 강남구",
      JinRyoHyungTae: "일반외래",
      RetrieveTreatmentInjectionInformationPersonDetailList: [
        {
          ChoBangYakPumMyung: "아스피린정 100mg",
          IlHoeYongRyang: "1정",
          IlIlYongHoesu: "1회"
        },
        {
          ChoBangYakPumMyung: "오메가3 캡슐",
          IlHoeYongRyang: "2캡슐",
          IlIlYongHoesu: "2회"
        }
      ]
    },
    {
      JinRyoGaesiIl: "2024-08-20",
      ByungEuiwonYakGukMyung: "서울대학교병원",
      Address: "서울시 종로구",
      JinRyoHyungTae: "일반외래",
      RetrieveTreatmentInjectionInformationPersonDetailList: [
        {
          ChoBangYakPumMyung: "혈압약 (ACE억제제)",
          IlHoeYongRyang: "1정",
          IlIlYongHoesu: "1회"
        },
        {
          ChoBangYakPumMyung: "소화제",
          IlHoeYongRyang: "1정",
          IlIlYongHoesu: "3회"
        }
      ]
    },
    {
      JinRyoGaesiIl: "2024-07-25",
      ByungEuiwonYakGukMyung: "강남세브란스병원",
      Address: "서울시 강남구",
      JinRyoHyungTae: "일반외래",
      RetrieveTreatmentInjectionInformationPersonDetailList: [
        {
          ChoBangYakPumMyung: "비타민D 정제",
          IlHoeYongRyang: "1정",
          IlIlYongHoesu: "1회"
        }
      ]
    }
  ]
};

// Mock 데이터를 localStorage에 저장
const mockCollectedData = {
  health_data: mockHealthData,
  prescription_data: mockPrescriptionData,
  collected_at: new Date().toISOString()
};

localStorage.setItem('tilko_collected_data', JSON.stringify(mockCollectedData));

// 페이지 새로고침으로 버튼 표시 업데이트
window.dispatchEvent(new Event('localStorageChange'));

console.log('✅ 테스트 데이터가 성공적으로 추가되었습니다!');
console.log('🏥 건강검진 데이터:', mockHealthData.ResultList.length, '건');
console.log('💊 처방전 데이터:', mockPrescriptionData.ResultList.length, '건');
console.log('🧠 이제 우측 하단에 "분석보기" 버튼이 나타날 것입니다.');

