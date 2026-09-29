/* KAIST ITM 대시보드 콘텐츠. 이 파일만 고치면 페이지가 갱신된다.
   일정 출처(2026-09-29): ITM69000=강의 사이트, 그 외=각 과목 폴더 AGENTS.md 커리큘럼 표.
   개념정리 상태: live(공개) | planned(준비 중) | private(비공개, label 표시) */
window.ITM = {
  profile: {
    name: '김예나',
    nameEn: 'Yena Kim',
    handle: 'Yenarue',
    cohort: 'KAIST 기술경영전문대학원 ITM 32기',
    headline: 'Generalist Software Engineer',
    // [초안] 최종 문장은 본인이 다듬는다 (Honor Code)
    summary: [
      '코드로 제품을 만들던 엔지니어가, 창업과 대기업을 오가며 부딪힌 "기술을 어떻게 사업으로 만드나"라는 질문을 KAIST ITM에서 체계적으로 공부하고 있습니다.',
      '수업마다 AI와 토론하며 개념을 정리하고, 그 결과를 이렇게 웹으로 쌓아 둡니다.'
    ],
    career: [
      { period: '2021.08 –', role: 'Staff Software Engineer', org: '삼성전자 Wallet개발그룹', desc: 'Samsung Wallet 디지털 키(차량 CCC · 도어락 Aliro) 클라이언트 개발 · 2025 그룹 Change Agent' },
      { period: '2020.12 – 2021.07', role: 'Consultant', org: 'Freelance', desc: '스타트업 프로덕트 기획·디지털 전환 자문' },
      { period: '2018.07 – 2021.02', role: 'Co-Founder & CTO', org: '포메이커스 (삼성전자 C-Lab 스핀오프)', desc: '비대면 게임 테스트 플랫폼, 전략·개발·팀 빌딩' },
      { period: '2014.03 – 2018.06', role: 'Software Engineer', org: '삼성전자 무선사업부 · C-Lab', desc: '삼성페이 선행개발(공통 모듈), C-Lab AppBee 풀스택' }
    ],
    links: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/yena-kim-yenarue/' },
      { label: 'Blog', url: 'https://yenarue.github.io' },
      { label: 'GitHub', url: 'https://github.com/yenarue' }
    ]
  },

  terms: [
    {
      id: '2026-fall', label: '2026 가을학기 (2학기)', start: '2026-08-31', current: true,
      courses: [
        { code: 'ITM69000', name: '인공지능 경영과 법', professor: '김병필', schedule: '목 19:00–22:00 · Zoom', color: '--brand',
          notes: { status: 'planned' },
          links: [{ label: '강의 사이트', url: 'https://byoungpil-kim.github.io/ai-law-lectures/itm690-2026-fall/' }] },
        { code: 'ITM60034', name: '혁신생태계론', professor: '임홍탁', schedule: '토 13:00–16:00', color: '--prof',
          notes: { status: 'live', url: 'notes/innovation_ecosystem/' }, links: [] },
        { code: 'ITM60062', name: '아키텍쳐 혁신과 모노즈쿠리', professor: '박정규', schedule: '토 16:00–19:00', color: '--slide',
          notes: { status: 'planned' }, links: [] },
        { code: 'ITM50023', name: '인공지능 특허전략', professor: '윤태성', schedule: '토', color: '--note',
          notes: { status: 'planned' }, links: [] }
      ]
    },
    {
      id: '2026-summer', label: '2026 여름학기', start: '2026-06-22', current: false,
      courses: [
        { code: 'CC.50011', name: '확률및통계학', professor: '', schedule: '', color: '--term',
          notes: { status: 'planned' }, links: [] }
      ]
    },
    {
      id: '2026-spring', label: '2026 봄학기 (1학기)', start: '2026-03-02', current: false,
      courses: [
        { code: 'ITM50001', name: '이노베이션 경영', professor: '김의석', schedule: '', color: '--brand',
          notes: { status: 'live', url: 'notes/innovation_management_review/' }, links: [] },
        { code: 'ITM50002', name: '기업가정신', professor: '노수홍', schedule: '', color: '--prof',
          notes: { status: 'planned' }, links: [] },
        { code: 'ITM89912', name: '생성형AI 논문', professor: '김하나', schedule: '', color: '--slide',
          notes: { status: 'private', label: '해외 저널 리뷰 중' }, links: [] }
      ]
    }
  ],

  events: [
    // ITM69000 인공지능 경영과 법 (목)
    { date: '2026-09-03', course: 'ITM69000', type: 'class', title: '강의소개 · 인공지능 기본 개념, 딥러닝' },
    { date: '2026-09-10', course: 'ITM69000', type: 'class', title: 'LLM과 기반모델' },
    { date: '2026-09-17', course: 'ITM69000', type: 'class', title: '실습 (1) GitHub · 웹 스크래핑' },
    { date: '2026-09-24', course: 'ITM69000', type: 'holiday', title: '추석 휴강' },
    { date: '2026-10-01', course: 'ITM69000', type: 'presentation', title: '수강생 발표 (1) 자기소개 페이지 · 스크래핑 분석' },
    { date: '2026-10-08', course: 'ITM69000', type: 'class', title: '법적 쟁점 (1) 개인정보 보호와 보안' },
    { date: '2026-10-15', course: 'ITM69000', type: 'class', title: '실습 (2) 웹 서비스 배포' },
    { date: '2026-10-22', course: 'ITM69000', type: 'holiday', title: '중간고사 기간 휴강' },
    { date: '2026-10-29', course: 'ITM69000', type: 'presentation', title: '수강생 발표 (2) 업무 적용 사례 · 배포 결과' },
    { date: '2026-11-05', course: 'ITM69000', type: 'class', title: '법적 쟁점 (2) AI 규제 (EU AI Act, 인공지능 기본법)' },
    { date: '2026-11-12', course: 'ITM69000', type: 'class', title: '실습 (3) 멀티에이전트 시스템' },
    { date: '2026-11-19', course: 'ITM69000', type: 'class', title: '법적 쟁점 (3) AI와 지식재산권' },
    { date: '2026-11-26', course: 'ITM69000', type: 'holiday', title: '휴강 (입학전형 면접)' },
    { date: '2026-12-03', course: 'ITM69000', type: 'presentation', title: '기말 발표 (1) AI 서비스 MVP + 법적 쟁점' },
    { date: '2026-12-10', course: 'ITM69000', type: 'presentation', title: '기말 발표 (2) AI 서비스 MVP + 법적 쟁점' },
    { date: '2026-12-17', course: 'ITM69000', type: 'holiday', title: '기말고사 기간 (보강 예비일)' },

    // ITM60034 혁신생태계론 (토 13:00)
    { date: '2026-09-05', course: 'ITM60034', type: 'class', title: 'Introduction: Innovation Ecosystem' },
    { date: '2026-09-12', course: 'ITM60034', type: 'class', title: '혁신의 미시적 기초' },
    { date: '2026-09-19', course: 'ITM60034', type: 'exam', title: 'Quiz 1 · 혁신에의 거시적 접근 I' },
    { date: '2026-09-26', course: 'ITM60034', type: 'holiday', title: '추석 휴강' },
    { date: '2026-10-03', course: 'ITM60034', type: 'class', title: '혁신에의 거시적 접근 II (Zoom)' },
    { date: '2026-10-10', course: 'ITM60034', type: 'class', title: '부문혁신시스템 (SIS)' },
    { date: '2026-10-17', course: 'ITM60034', type: 'exam', title: 'Quiz 2 · 기술혁신시스템 (TIS) + GIS' },
    { date: '2026-10-24', course: 'ITM60034', type: 'class', title: 'SSIP + 비즈니스 시스템 (Zoom)' },
    { date: '2026-10-31', course: 'ITM60034', type: 'exam', title: 'Quiz 3 · 사회기술시스템 (StS)' },
    { date: '2026-11-07', course: 'ITM60034', type: 'class', title: '시스템 전환론 I: 전환적 사회혁신' },
    { date: '2026-11-14', course: 'ITM60034', type: 'exam', title: 'Quiz 4 · 시스템 전환론 II: BMI' },
    { date: '2026-11-21', course: 'ITM60034', type: 'class', title: '시스템 전환론 III: 일상생활방식 접근' },
    { date: '2026-11-28', course: 'ITM60034', type: 'exam', title: 'Quiz 5 · 시스템 전환론 IV: 임무지향형 혁신정책' },
    { date: '2026-12-05', course: 'ITM60034', type: 'class', title: '시스템 전환과 국가의 역할: 개발국가' },
    { date: '2026-12-12', course: 'ITM60034', type: 'exam', title: 'Quiz 6 · 시스템 전환과 시민의 역할' },
    { date: '2026-12-19', course: 'ITM60034', type: 'assignment', title: 'Final: Term Paper 제출' },

    // ITM60062 아키텍쳐 혁신과 모노즈쿠리 (토 16:00)
    { date: '2026-09-05', course: 'ITM60062', type: 'class', title: '아키텍처 혁신론 소개 · Henderson & Clark' },
    { date: '2026-09-12', course: 'ITM60062', type: 'class', title: '모듈형 vs 통합형 아키텍처 · Ulrich' },
    { date: '2026-09-18', course: 'ITM60062', type: 'assignment', title: '과제1 Henderson 논문 요약' },
    { date: '2026-09-19', course: 'ITM60062', type: 'class', title: 'DSM (Design Structure Matrix) 실습' },
    { date: '2026-09-26', course: 'ITM60062', type: 'assignment', title: 'Process DSM 과제' },
    { date: '2026-09-26', course: 'ITM60062', type: 'holiday', title: '추석 휴강' },
    { date: '2026-10-03', course: 'ITM60062', type: 'holiday', title: '개천절 휴강' },
    { date: '2026-10-09', course: 'ITM60062', type: 'assignment', title: '과제2 Ulrich(1995) 요약' },
    { date: '2026-10-10', course: 'ITM60062', type: 'class', title: '경쟁 전략론 리뷰', tentative: true },
    { date: '2026-10-17', course: 'ITM60062', type: 'class', title: '아키텍처 전략론 · 모노즈쿠리 경쟁전략', tentative: true },
    { date: '2026-10-24', course: 'ITM60062', type: 'class', title: '오픈/클로즈드 전략', tentative: true },
    { date: '2026-10-31', course: 'ITM60062', type: 'class', title: '모듈러 설계의 개념', tentative: true },
    { date: '2026-11-07', course: 'ITM60062', type: 'class', title: '제품의 구조적 이해 · 플랫폼 전략', tentative: true },
    { date: '2026-11-14', course: 'ITM60062', type: 'class', title: '제품개발 프로세스', tentative: true },
    { date: '2026-11-21', course: 'ITM60062', type: 'class', title: '소프트웨어가 아키텍처에 주는 영향', tentative: true },
    { date: '2026-11-28', course: 'ITM60062', type: 'class', title: '자동차 산업의 아키텍처 경쟁', tentative: true },
    { date: '2026-12-05', course: 'ITM60062', type: 'class', title: '전자·컴퓨터 / 제철 산업의 아키텍처 경쟁', tentative: true },
    { date: '2026-12-12', course: 'ITM60062', type: 'class', title: '아키텍처의 동태성 · R&D 조직', tentative: true },
    { date: '2026-12-19', course: 'ITM60062', type: 'presentation', title: 'Term Project 발표', tentative: true },

    // ITM50023 인공지능 특허전략 (토) — 발명 내용은 적지 않는다
    { date: '2026-09-05', course: 'ITM50023', type: 'class', title: '주제 선정 · 아이디어 발상' },
    { date: '2026-09-12', course: 'ITM50023', type: 'class', title: 'Flow Chart 작성 (data, BM)' },
    { date: '2026-09-19', course: 'ITM50023', type: 'class', title: '학습용 dataset 작성' },
    { date: '2026-09-26', course: 'ITM50023', type: 'holiday', title: '추석 · KIPRIS 검색 자습' },
    { date: '2026-10-03', course: 'ITM50023', type: 'holiday', title: '개천절 휴강' },
    { date: '2026-10-10', course: 'ITM50023', type: 'class', title: '내용 작성' },
    { date: '2026-10-17', course: 'ITM50023', type: 'class', title: '변리사 강연 + 아이디어 평가 ①' },
    { date: '2026-10-24', course: 'ITM50023', type: 'assignment', title: '중간리포트 KLMS 제출' },
    { date: '2026-10-31', course: 'ITM50023', type: 'class', title: '내용 작성' },
    { date: '2026-11-07', course: 'ITM50023', type: 'class', title: '특허심사 강연 + 아이디어 평가 ②' },
    { date: '2026-11-14', course: 'ITM50023', type: 'class', title: '내용 작성' },
    { date: '2026-11-21', course: 'ITM50023', type: 'class', title: '발명신고서 · 추가설명서 작성' },
    { date: '2026-11-28', course: 'ITM50023', type: 'class', title: '특허재판 강연 + 아이디어 평가 ③' },
    { date: '2026-12-05', course: 'ITM50023', type: 'assignment', title: '발명신고 (발명자 전원 서명)' },
    { date: '2026-12-12', course: 'ITM50023', type: 'assignment', title: '최종 자료 제출' }
  ],

  projects: [
    { title: 'KAIST ITM 학업 대시보드', desc: '과목·일정·개념정리·결과물을 링크 하나로. 지금 보고 있는 이 페이지', course: 'ITM69000', url: '#top', status: 'live' },
    { title: '웹 스크래핑 데이터 분석', desc: '공개 데이터를 수집하고 EDA로 패턴을 찾은 분석 페이지 (W03 과제2)', course: 'ITM69000', url: '', status: 'wip' },
    { title: '혁신생태계론 개념 지도', desc: '주차를 넘나드는 개념 연결을 그래프로', course: 'ITM60034', url: 'notes/innovation_ecosystem/map.html', status: 'live' },
    { title: '혁신생태계론 퀴즈 셀프테스트', desc: '누적 범위 서술형 퀴즈 대비, 중요도 정렬', course: 'ITM60034', url: 'notes/innovation_ecosystem/quiz.html', status: 'live' }
  ],

  workflow: [
    { step: '강의자료', desc: '주차별 PDF와 수업 녹취를 과목 폴더에 모은다' },
    { step: 'AI와 토론', desc: '수업 중·후 AI와 개념을 검증하고 반론을 붙여 본다' },
    { step: '개념정리', desc: '주차별 마크다운으로 개념·논점·사례를 정리한다' },
    { step: '웹으로 배포', desc: '정리본을 정적 사이트로 빌드해 GitHub Pages에 올린다', evidence: { label: '혁신생태계론 정리', url: 'notes/innovation_ecosystem/' } },
    { step: '복습', desc: '퀴즈·개념 지도로 다시 꺼내 본다', evidence: { label: '퀴즈', url: 'notes/innovation_ecosystem/quiz.html' } }
  ]
};
