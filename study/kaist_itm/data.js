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
    // ✏️ 한 줄 소개 — 본인이 직접 수정 (현재는 v1 About의 한 줄 소개)
    tagline: 'Generalist Software Engineer',
    // ✏️ 프로필 사진 — 파일을 study/kaist_itm/assets/ 에 넣고 'assets/profile.jpg' 처럼 지정. 비우면 이니셜 아바타
    photo: '',
    // [초안] 최종 문장은 본인이 다듬는다 (Honor Code)
    summary: [
      '코드로 제품을 만들던 엔지니어가, 창업과 대기업을 오가며 부딪힌 "기술을 어떻게 사업으로 만드나"라는 질문을 KAIST ITM에서 체계적으로 공부하고 있습니다.'
    ],
    facts: [
      { label: '현재', value: 'DX부문 MX사업부 DigitalWallet팀 Wallet개발그룹 Staff Software Engineer' },
      { label: '학위', value: 'KAIST 기술경영전문대학원 I&TM 석사과정 1년차 (2026.03~)' },
      { label: '전공', value: '컴퓨터공학 학사' },
      { label: '관심', value: '기술경영 · AI 규제 · 플랫폼 생태계' },
      { label: '연락', value: 'yenarue@gmail.com', url: 'mailto:yenarue@gmail.com' }
    ],
    // ✏️ 관심 연구 주제 — 아래 4개는 느낌을 보기 위한 [샘플]. 본인이 직접 고쳐 쓴다.
    // 형식: { title: '주제', desc: '한두 문장 설명' }
    // 배열을 비우면 About 페이지에 "준비 중" 안내가 나온다.
    interests: [
      { title: 'AI 규제와 책임 있는 제품 설계', desc: '[샘플] EU AI Act·인공지능 기본법 같은 규제가 제품 기획과 개발 프로세스를 어떻게 바꾸는가.' },
      { title: '디지털 신원·지갑 플랫폼 생태계', desc: '[샘플] 디지털 키 표준(CCC, Aliro)을 둘러싼 제조사·플랫폼·파트너의 협력과 경쟁 구조.' },
      { title: '소프트웨어 아키텍처와 조직', desc: '[샘플] 모듈화·플랫폼 전략이 제품 구조와 개발 조직을 함께 결정하는 방식.' },
      { title: 'AI 시대의 지식재산 전략', desc: '[샘플] AI 발명을 특허로 보호할지, 영업비밀로 둘지에 대한 전략적 선택.' }
    ],
    // ✏️ 경력·학력 오버뷰 — 한 방향 흐름 카드. 제목·설명은 본인이 직접 수정
    journey: [
      { title: '컴퓨터공학 출신 기술쟁이', desc: '보안·임베디드·AI 동아리와 경진대회로 기술의 기본기를 다짐' },
      { title: '삼성페이 초기 멤버', desc: '선행개발팀에 합류해 MVP부터 출시·안정화까지 함께함' },
      { title: '창업(Co-Founder,CTO)', desc: 'C-Lab 스핀오프 포메이커스를 공동창업해 제품·팀·사업을 한꺼번에 경험' },
      { title: '삼성월렛 디지털 키 · 조직문화', desc: '디지털 키 개발, 그룹 Change Agent로 160명 조직문화를 리딩' },
      { title: 'KAIST I&TM', desc: '기술을 사업으로 만드는 방법을 체계적으로 공부하는 중' }
    ],
    timeline: [
      { period: '2026.03 –', kind: 'education', role: 'I&TM 석사과정 (32기)', org: 'KAIST 기술경영전문대학원',
        highlights: ['혁신생태계론, 아키텍처 혁신, AI 특허전략, AI 경영과 법 수강 중'] },
      { period: '2021.08 –', kind: 'career', role: 'Staff Software Engineer', org: '삼성전자 Wallet개발그룹',
        highlights: ['Samsung Wallet 디지털 키 클라이언트 개발 (차량 CCC · 도어락 Aliro 표준)',
                     '2025 그룹 Change Agent: 구미·수원 약 160명 대상 조직문화 활동 리딩 ("칭찬의 신"·"번개의 신" 기획)'] },
      { period: '2020.12 – 2021.07', kind: 'career', role: 'Consultant', org: 'Freelance',
        highlights: ['스타트업 비즈니스 전략·프로덕트 기획·MVP 개발 자문 (디지털 전환)'] },
      { period: '2018.07 – 2021.02', kind: 'career', role: 'Co-Founder & CTO', org: '포메이커스 (삼성전자 C-Lab 스핀오프)',
        highlights: ['비대면 게임 테스트 플랫폼 "포메스 & 포메이커스" 기획·개발·로드맵',
                     '정성 피드백 자연어 처리·데이터 분석, 개발팀 채용·온보딩·문화 구축'] },
      { period: '2017.07 – 2018.06', kind: 'career', role: 'Full Stack Software Engineer', org: '삼성전자 C-Lab Looky팀',
        highlights: ['모바일 앱 사용 데이터 기반 사용자 인터뷰 플랫폼 AppBee MVP', 'TDD·페어 프로그래밍 기반 스몰팀 개발 → 스핀오프 창업'] },
      { period: '2014.03 – 2018.06', kind: 'career', role: 'Software Engineer', org: '삼성전자 무선사업부',
        highlights: ['삼성페이 선행개발 Common/KR 파트 (v1.2~3.9): 결제 흐름·네트워크·공통 DB 모듈', '무선사업부 전 프로젝트 소프트웨어 형상관리'] },
      { period: '2012.01 – 2014.01', kind: 'education', role: 'Software Member (22-1기)', org: '삼성소프트웨어멤버십',
        highlights: ['프로젝트 5건, SIG 4개 참여(보안 SIG 리더)'] },
      { period: '2010.03 – 2014.02', kind: 'education', role: '컴퓨터공학 학사', org: '', highlights: [] }
    ],
    // ✏️ year가 빈 항목은 연도 확인 후 채운다 (형식 'YYYY' 또는 'YYYY.MM')
    credentials: {
      patents: [
        { title: '테스트 서비스 제공 방법', year: '2020' },
        { title: '결제를 수행하는 전자 장치 및 방법', year: '2016' }
      ],
      awards: [
        { title: '제1회 예술데이터가 바꾸는 세상 우수상', year: '2020' },
        { title: '한국지능로봇경진대회 특허청장상', year: '2013' },
        { title: '창의작품경진대회 대상', year: '2013' },
        { title: '제9회 국제해킹방어대회(HDCon) 은상', year: '2013' },
        { title: '삼성소프트웨어멤버십 소프트웨어 프로젝트 1위', year: '2012' }
      ],
      certifications: [
        { title: 'Software Certification – Associate Architect (Best Practice)', year: '' },
        { title: 'Software Certification – Best Reviewer', year: '' },
        { title: 'Agile Coach Squared (AC2) Level 1·2', year: '' },
        { title: '정보처리기사', year: '' },
        { title: '리눅스마스터 2급', year: '' },
        { title: '데이터분석 준전문가 (ADsP)', year: '' }
      ],
      publications: [
        // ✏️ 학회명 확인 (블로그 기록 "전자공학회 논문 출품 2013" 기준)
        { title: 'Kinect와 Unity3D를 이용한 체감형 3D 가상현실 재활치료 시스템', year: '2013', venue: '대한전자공학회' }
      ]
    },
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
          notes: { status: 'live', url: 'notes/innovation_ecosystem/',
            extraLinks: [{ label: '🗺️ 개념 지도', url: 'notes/innovation_ecosystem/map.html' }, { label: '🏷️ 퀴즈', url: 'notes/innovation_ecosystem/quiz.html' }] }, links: [] },
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
        { code: 'ITM89912', name: '생성형 인공지능 활용 기술경영 연구', professor: '김하나', schedule: '', color: '--slide',
          notes: { status: 'private', label: '해외 저널 리뷰 중', url: 'projects/genai-paper/', urlLabel: '공개 개요 보기' }, links: [] }
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

  // 프로젝트 종류 — 프로젝트가 늘면 여기서 추가·수정한다
  projectCategories: [
    { id: 'research', label: '연구', desc: '논문·특허처럼 새로운 지식을 만드는 작업' },
    { id: 'analysis', label: '분석', desc: '데이터를 모으고 패턴을 찾는 작업' },
    { id: 'study', label: '학습', desc: '수업 내용을 정리하고 복습하는 도구' }
  ],

  projects: [
    // 심사 중 논문 — 상세 페이지는 공개 가능한 범위의 개요만 담는다
    { title: 'AI를 많이 쓰면 성과가 날까?', desc: '기업의 AI 활용이 성과로 이어지는 조직적 조건 연구 · 해외 저널 Information & Management 투고', category: 'research', courses: ['ITM89912'], url: 'projects/genai-paper/', status: 'live', linkLabel: '공개 개요 보기', badge: 'Under Review' },
    { title: 'AI 특허 발명', desc: '아이디어 발상부터 발명신고까지 실제 특허 1건을 진행', category: 'research', courses: ['ITM50023'], status: 'private', label: '출원 전 비공개' },
    { title: '웹 스크래핑 데이터 분석', desc: '공개 데이터를 수집하고 EDA로 패턴을 찾은 분석 페이지 (W03 과제2)', category: 'analysis', courses: ['ITM69000'], url: '', status: 'wip' },
    // 과목 외 활동 — 제목은 분석 주제, 대회명은 설명·활동 태그로
    { title: 'AI 모델 증류 방지·추적 특허 분석', desc: '2026 캠퍼스 특허 유니버시아드 · 특허 5,575건으로 찾은 기술 공백과 IP 전략', category: 'analysis', courses: [], activity: '캠퍼스 특허 유니버시아드 2026', url: 'projects/cpu-2026-ai-distillation/', status: 'live' },
    { title: 'KAIST ITM 학업 대시보드', desc: '과목·일정·개념정리·프로젝트를 링크 하나로 (W03 과제1)', category: 'study', courses: ['ITM69000'], url: 'index.html', status: 'live' },
    { title: '혁신생태계론 개념정리 사이트', desc: '주차별 개념 정리와 검색, 주차를 넘나드는 개념 지도, 누적 범위 퀴즈 셀프테스트', category: 'study', courses: ['ITM60034'], url: 'notes/innovation_ecosystem/', status: 'live',
      extraLinks: [{ label: '🗺️ 개념 지도', url: 'notes/innovation_ecosystem/map.html' }, { label: '🏷️ 퀴즈', url: 'notes/innovation_ecosystem/quiz.html' }] },
    { title: '이노베이션 경영 개념 정리', desc: '기말시험 대비 핵심 개념 요약', category: 'study', courses: ['ITM50001'], url: 'notes/innovation_management_review/', status: 'live' }
  ],

  // 'KAIST ITM에서 이렇게 공부합니다' 섹션 설명
  workflowIntro: '수업마다 AI와 토론하며 개념을 정리하고, 그 결과를 이렇게 웹으로 쌓아 둡니다.',

  workflow: [
    { step: '강의자료', desc: '주차별 PDF와 수업 녹취를 과목 폴더에 모은다' },
    { step: 'AI와 토론', desc: '수업 중·후 AI와 개념을 검증하고 반론을 붙여 본다' },
    { step: '개념정리', desc: '주차별 마크다운으로 개념·논점·사례를 정리한다' },
    { step: '웹으로 배포', desc: '정리본을 정적 사이트로 빌드해 GitHub Pages에 올린다', evidence: { label: '혁신생태계론 정리', url: 'notes/innovation_ecosystem/' } },
    { step: '복습', desc: '퀴즈·개념 지도로 다시 꺼내 본다', evidence: { label: '퀴즈', url: 'notes/innovation_ecosystem/quiz.html' } }
  ]
};
