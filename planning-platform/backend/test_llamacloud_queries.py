"""
LlamaCloud Playground 테스트 쿼리를 실제 시스템에서 실행
"""
import asyncio
import json
from datetime import datetime
from app.services.checkup_design import init_rag_engine

async def test_llamacloud_queries():
    """LlamaCloud Playground 쿼리 테스트"""
    
    # 테스트 쿼리 목록
    queries = [
        {
            "id": 1,
            "title": "혈액검사 간수치 정상이어도 영상검사 필요한 이유",
            "query": "혈액검사에서 간 수치(AST/ALT)가 정상이어도 간 초음파나 CT 같은 영상 검사가 꼭 필요한 이유는 무엇인가요? '혈액검사의 한계'와 최근 개정된 '대사이상지방간(MASLD)' 가이드라인을 바탕으로, 지방간이나 섬유화가 있어도 수치가 정상일 수 있는 이유를 설명해 주세요."
        },
        {
            "id": 2,
            "title": "당뇨병 환자의 신장/심혈관 합병증 예방 선별검사",
            "query": "당뇨병 환자가 혈당 관리 외에 '신장'과 '심혈관' 합병증 예방을 위해 매년 필수적으로 받아야 할 선별검사는 무엇인가요? 진료지침에 명시된 요알부민배설량 및 eGFR 평가 기준과, 이와 연계된 SGLT2 억제제 투여 권고 사항을 찾아주세요."
        },
        {
            "id": 3,
            "title": "이상지질혈증 초고위험군 LDL 목표치",
            "query": "2022년 이상지질혈증 진료지침에 따르면, 심혈관질환을 앓고 있는 '초고위험군' 환자의 LDL 콜레스테롤 치료 목표 수치는 구체적으로 얼마인가요? 목표 도달 실패 시 권고되는 에제티미브(Ezetimibe) 및 PCSK9 억제제 병용 전략에 대해 알려주세요."
        },
        {
            "id": 4,
            "title": "흉부 X-ray vs 저선량 CT",
            "query": "일반 흉부 X-ray 검사만으로는 폐암 발견에 어떤 한계(사각지대)가 있나요? 국가암검진 권고안에 따른 저선량 흉부 CT 검사 대상자 기준(나이, 흡연력)과, 이를 통해 확인할 수 있는 구조적 이점에 대해 설명해 주세요."
        },
        {
            "id": 5,
            "title": "액체생검 원리와 적응증",
            "query": "최신 암 스크리닝 기술인 '액체생검(예: 캔서파인드)'이 혈액 내 ctDNA를 분석하여 암을 조기에 발견하는 원리는 무엇인가요? 기존 조직 검사나 영상 검사가 가진 한계를 보완할 수 있는 적응증(재발 모니터링, 조직 확보 곤란 등)에 대해 설명해 주세요."
        }
    ]
    
    print("\n" + "="*100)
    print("🧪 LlamaCloud Playground 쿼리 테스트")
    print("="*100)
    print(f"\n총 {len(queries)}개 쿼리 테스트 시작")
    print(f"테스트 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # RAG 엔진 초기화
    print("\n" + "-"*100)
    print("🚀 RAG 엔진 초기화 중...")
    print("-"*100)
    
    try:
        query_engine = await init_rag_engine()
        
        if not query_engine:
            print("❌ RAG 엔진 초기화 실패")
            print("\n환경 변수 확인:")
            print("  - LLAMAINDEX_API_KEY 설정 필요")
            print("  - GOOGLE_GEMINI_API_KEY 설정 필요")
            return
        
        print("✅ RAG 엔진 초기화 성공")
        
    except Exception as e:
        print(f"❌ RAG 엔진 초기화 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return
    
    # 각 쿼리 실행
    results = []
    
    for i, query_info in enumerate(queries, 1):
        print("\n" + "="*100)
        print(f"🔍 쿼리 {i}/{len(queries)}: {query_info['title']}")
        print("="*100)
        
        print(f"\n📝 질문:")
        print(f"{query_info['query']}")
        
        print(f"\n⏱️ 검색 시작...")
        start_time = datetime.now()
        
        try:
            # RAG 검색 실행
            response = query_engine.query(query_info['query'])
            
            elapsed_time = (datetime.now() - start_time).total_seconds()
            
            # 응답 텍스트
            response_text = str(response) if response else ""
            
            # 소스 노드 (참고 문서)
            sources = []
            if hasattr(response, 'source_nodes') and response.source_nodes:
                for node in response.source_nodes:
                    source_info = {
                        "score": getattr(node, 'score', None),
                        "text": node.node.text[:200] + "..." if hasattr(node, 'node') and hasattr(node.node, 'text') else ""
                    }
                    if hasattr(node, 'node') and hasattr(node.node, 'metadata'):
                        source_info['metadata'] = node.node.metadata
                    sources.append(source_info)
            
            print(f"\n✅ 검색 완료 (소요 시간: {elapsed_time:.2f}초)")
            print(f"\n{'─'*100}")
            print("💬 RAG 응답:")
            print(f"{'─'*100}")
            print(response_text)
            
            if sources:
                print(f"\n{'─'*100}")
                print(f"📚 참고 문서 ({len(sources)}개):")
                print(f"{'─'*100}")
                for j, source in enumerate(sources[:3], 1):  # 처음 3개만
                    print(f"\n[{j}] 신뢰도: {source.get('score', 'N/A')}")
                    if source.get('metadata'):
                        print(f"    메타데이터: {json.dumps(source['metadata'], ensure_ascii=False, indent=6)}")
                    print(f"    내용: {source.get('text', 'N/A')}")
            
            results.append({
                "query_id": query_info['id'],
                "title": query_info['title'],
                "success": True,
                "response": response_text,
                "sources_count": len(sources),
                "elapsed_time": elapsed_time
            })
            
        except Exception as e:
            elapsed_time = (datetime.now() - start_time).total_seconds()
            print(f"\n❌ 검색 실패 (소요 시간: {elapsed_time:.2f}초)")
            print(f"에러: {str(e)}")
            import traceback
            traceback.print_exc()
            
            results.append({
                "query_id": query_info['id'],
                "title": query_info['title'],
                "success": False,
                "error": str(e),
                "elapsed_time": elapsed_time
            })
        
        # 다음 쿼리 전 잠시 대기 (API 레이트 리밋)
        if i < len(queries):
            print(f"\n⏳ 다음 쿼리까지 2초 대기...")
            await asyncio.sleep(2)
    
    # 최종 요약
    print("\n" + "="*100)
    print("📊 테스트 결과 요약")
    print("="*100)
    
    success_count = sum(1 for r in results if r['success'])
    total_time = sum(r['elapsed_time'] for r in results)
    
    print(f"\n✅ 성공: {success_count}/{len(results)}개")
    print(f"⏱️ 총 소요 시간: {total_time:.2f}초")
    print(f"⏱️ 평균 응답 시간: {total_time/len(results):.2f}초")
    
    print(f"\n{'─'*100}")
    print("쿼리별 결과:")
    print(f"{'─'*100}")
    for r in results:
        status = "✅" if r['success'] else "❌"
        print(f"{status} [{r['query_id']}] {r['title']}")
        print(f"    소요 시간: {r['elapsed_time']:.2f}초")
        if r['success']:
            print(f"    참고 문서: {r.get('sources_count', 0)}개")
            print(f"    응답 길이: {len(r.get('response', '')):,}자")
        else:
            print(f"    에러: {r.get('error', 'Unknown')}")
    
    # 결과를 JSON 파일로 저장
    output_file = f"llamacloud_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "test_time": datetime.now().isoformat(),
            "total_queries": len(queries),
            "success_count": success_count,
            "total_time": total_time,
            "results": results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 결과가 {output_file}에 저장되었습니다.")
    
    return results


if __name__ == "__main__":
    asyncio.run(test_llamacloud_queries())

