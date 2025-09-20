"""
틸코 API 더미 데이터 (레퍼런스 코드 구조 기반)
"""
from datetime import datetime, timedelta

# 더미 건강검진 데이터 (레퍼런스 구조)
DUMMY_HEALTH_SCREENING_DATA = {
    "Status": "Success",
    "Message": "정상적으로 조회되었습니다.",
    "ResultList": [
        {
            "Year": "2024년",
            "CheckUpDate": "03/15",
            "Location": "김현우내과",
            "Inspections": [
                {
                    "Gubun": "계측검사",
                    "Illnesses": [
                        {
                            "Items": [
                                {"Name": "신장", "Value": "175.0"},
                                {"Name": "체중", "Value": "70.0"},
                                {"Name": "허리둘레", "Value": "85.0"},
                                {"Name": "혈압(최고/최저)", "Value": "120/80"},
                                {"Name": "체질량지수", "Value": "22.9"}
                            ]
                        }
                    ]
                },
                {
                    "Gubun": "요검사", 
                    "Illnesses": [
                        {
                            "Items": [
                                {"Name": "요단백", "Value": "음성"}
                            ]
                        }
                    ]
                },
                {
                    "Gubun": "혈액검사",
                    "Illnesses": [
                        {
                            "Items": [
                                {"Name": "혈색소", "Value": "14.5"},
                                {"Name": "AST(SGOT)", "Value": "25"},
                                {"Name": "ALT(SGPT)", "Value": "28"},
                                {"Name": "감마지티피(y-GTP)", "Value": "22"},
                                {"Name": "총콜레스테롤", "Value": "180"},
                                {"Name": "HDL콜레스테롤", "Value": "55"},
                                {"Name": "LDL콜레스테롤", "Value": "110"},
                                {"Name": "중성지방", "Value": "120"},
                                {"Name": "공복혈당", "Value": "95"},
                                {"Name": "혈청크레아티닌", "Value": "1.0"},
                                {"Name": "신사구체여과율(GFR)", "Value": "90"}
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

# 더미 처방전 데이터 (레퍼런스 구조)
DUMMY_PRESCRIPTION_DATA = {
    "Status": "Success", 
    "Message": "정상적으로 조회되었습니다.",
    "ResultList": [
        {
            "Idx": "1",
            "ByungEuiwonYakGukMyung": "김현우내과[서울시 강남구]",
            "JinRyoGaesiIl": "20240910",
            "JinRyoHyungTae": "외래",
            "BangMoonIpWonIlsoo": "1",
            "CheoBangHoiSoo": "1", 
            "TuYakYoYangHoiSoo": "30",
            "RetrieveTreatmentInjectionInformationPersonDetailList": [
                {
                    "Idx": "1",
                    "JinRyoChoBangIlja": "20240910",
                    "JinRyoHyungTae": "외래", 
                    "ChoBangHoetSoo": "1",
                    "ChoBangYakPumMyung": "혈압약",
                    "ChoBangYakPumHyoneung": "고혈압 치료",
                    "TuyakIlSoo": "30",
                    "DrugCode": "BP001",
                    "NameAddr": "김현우내과[서울시 강남구]",
                    "RetrieveMdsupDtlInfo": {
                        "DrugCode": "BP001",
                        "MediPrdcNm": "혈압강하제",
                        "DrugImage": "",
                        "CmpnInfo": "암로디핀",
                        "TmsgGnlSpcd": "전문의약품",
                        "SnglCmtnYn": "단일",
                        "UpsoName": "제약회사A",
                        "Upso1": "판매사A",
                        "FomlCdXplnCnte": "정제",
                        "MdctPathXplnCnte": "경구",
                        "MohwClsfNoXplnCnte": "순환기관용약",
                        "AtcInfo": "C08CA01",
                        "KpicInfo": "214",
                        "EfftEftCnte": "고혈압 치료",
                        "UsagCpctCnte": "1일 1회 1정",
                        "UseAtntMttCnte": "식후 복용",
                        "CmnTmdcGdncCnte": "정해진 시간에 복용"
                    }
                },
                {
                    "Idx": "2", 
                    "JinRyoChoBangIlja": "20240910",
                    "JinRyoHyungTae": "외래",
                    "ChoBangHoetSoo": "1", 
                    "ChoBangYakPumMyung": "비타민D",
                    "ChoBangYakPumHyoneung": "비타민 보충",
                    "TuyakIlSoo": "30",
                    "DrugCode": "VD001",
                    "NameAddr": "김현우내과[서울시 강남구]",
                    "RetrieveMdsupDtlInfo": {
                        "DrugCode": "VD001",
                        "MediPrdcNm": "콜레칼시페롤",
                        "DrugImage": "",
                        "CmpnInfo": "비타민D3",
                        "TmsgGnlSpcd": "일반의약품",
                        "SnglCmtnYn": "단일",
                        "UpsoName": "제약회사B", 
                        "Upso1": "판매사B",
                        "FomlCdXplnCnte": "연질캡슐",
                        "MdctPathXplnCnte": "경구",
                        "MohwClsfNoXplnCnte": "비타민제",
                        "AtcInfo": "A11CC05",
                        "KpicInfo": "631",
                        "EfftEftCnte": "비타민D 결핍증 예방 및 치료",
                        "UsagCpctCnte": "1일 1회 1캡슐",
                        "UseAtntMttCnte": "식후 복용 권장",
                        "CmnTmdcGdncCnte": "충분한 물과 함께 복용"
                    }
                }
            ]
        }
    ]
}

# 더미 간편인증 응답 데이터
DUMMY_SIMPLE_AUTH_DATA = {
    "Status": "Success",
    "Message": "정상적으로 처리되었습니다.", 
    "ResultData": {
        "CxId": "dummy_cx_id_67890",
        "ReqTxId": "dummy_req_tx_id_98765", 
        "TxId": "dummy_tx_id_12345",
        "Token": "dummy_token_abcdef"
    }
}

# 더미 공개키
DUMMY_PUBLIC_KEY = """MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdef"""
