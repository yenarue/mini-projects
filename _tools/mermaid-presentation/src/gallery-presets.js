export const galleryPresets = [
  { id: 'flowchart', label: 'Flowchart', title: '흐름도', description: '작업의 순서와 분기를 한눈에 보여줍니다.', use: '프로세스 · 의사결정', code: `flowchart LR
    A[아이디어] --> B[검토] --> C[실행]
    B --> D[공유]` },
  { id: 'sequence', label: 'Sequence', title: '시퀀스 다이어그램', description: '시간 순서에 따른 참여자 간 메시지를 표현합니다.', use: '상호작용 · API', code: `sequenceDiagram
    participant U as 사용자
    participant A as 앱
    U->>A: 요청
    A-->>U: 결과` },
  { id: 'class', label: 'Class', title: '클래스 다이어그램', description: '구조와 관계를 객체 단위로 정리합니다.', use: '구조 · 모델', code: `classDiagram
    Project <|-- Task
    Project : 이름
    Task : 상태` },
  { id: 'state', label: 'State', title: '상태 다이어그램', description: '상태가 어떤 사건으로 바뀌는지 보여줍니다.', use: '상태 · 전이', code: `stateDiagram-v2
    [*] --> 초안
    초안 --> 검토 : 제출
    검토 --> 승인 : 통과
    검토 --> 초안 : 수정
    승인 --> [*]` },
  { id: 'er', label: 'ER', title: 'ER 다이어그램', description: '데이터 엔티티와 카디널리티를 표현합니다.', use: '데이터 · 관계', code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : includes` },
  { id: 'gantt', label: 'Gantt', title: '간트 차트', description: '작업 기간과 선후 관계를 일정으로 보여줍니다.', use: '일정 · 계획', code: `gantt
    title 프로젝트 일정
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    section 준비
    조사 :done, a1, 2026-10-01, 5d
    설계 :active, a2, after a1, 7d
    section 실행
    검증 :a3, after a2, 4d` },
  { id: 'mindmap', label: 'Mindmap', title: '마인드맵', description: '하나의 주제에서 뻗어 나가는 생각을 정리합니다.', use: '아이디어 · 구조화', code: `mindmap
    root((발표 준비))
      조사
        자료 수집
        핵심 질문
      구성
        시각화
        리허설
      공유
        피드백` },
  { id: 'timeline', label: 'Timeline', title: '타임라인', description: '시간의 흐름과 주요 사건을 이야기처럼 보여줍니다.', use: '변화 · 연혁', code: `timeline
    title 프로젝트의 흐름
    2026-10 : 문제 정의
             : 자료 수집
    2026-11 : 설계
    2026-12 : 발표` },
  { id: 'pie', label: 'Pie', title: '파이 차트', description: '비율과 구성을 빠르게 비교합니다.', use: '비중 · 비교', code: `pie title 업무 시간
    "분석" : 35
    "설계" : 40
    "검증" : 25` },
  { id: 'journey', label: 'Journey', title: '사용자 여정', description: '사용자의 단계별 경험과 만족도를 표현합니다.', use: '경험 · 서비스', code: `journey
    title 사용자가 과제를 제출하는 여정
    section 발견
      자료 찾기: 4: 사용자
      질문 만들기: 3: 사용자
    section 실행
      초안 작성: 3: 사용자
      피드백 반영: 5: 사용자, 교수` }
];
