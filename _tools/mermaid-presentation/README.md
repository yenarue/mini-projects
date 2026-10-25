# Mermaid · KAIST 7분 스크롤형 웹 발표

제목과 발표 정보로 시작해 **결과 → 개념 → 라이브 데모 → Mermaid의 세 가지 장점 → 다이어그램 갤러리 → AI + Mermaid → 실제 과제 → 네 가지 정리**를 스크롤하며 진행하는 페이지입니다. 이전 슬라이드 넘김 방식은 제거했습니다.

- 발표 파일: `study/kaist_itm/projects/mermaid-dsm-presentation/index.html`
- 개발 소스: `_tools/mermaid-presentation/`
- 이전 `seminar/mermaid.html`은 새 프로젝트 경로로 이동했습니다.

## 바로 실행 (npm 불필요)

```bash
cd /Users/yenarue/Developers/mini-projects
python3 -m http.server 8000 --bind 127.0.0.1
```

**http://127.0.0.1:8000/study/kaist_itm/projects/mermaid-dsm-presentation/** 에 접속합니다. 종료는 터미널 `Ctrl+C`.

다른 컴퓨터에서는 `mermaid-dsm-presentation/` 폴더 전체를 복사하고 그 폴더에서 `python3 -m http.server 8000`을 실행해 `http://localhost:8000/`을 엽니다. `index.html`뿐 아니라 `assets/`, `mermaid-assets/`도 함께 필요합니다. `file://` 직접 열기는 지원 경로가 아닙니다.

## 발표 흐름과 조작

| 시간 | 구간 | 진행 |
|---|---|---|
| 0:00–0:30 | 제목·소개 | 제목·소제목·우측 발표 정보 |
| 0:30–1:10 | 결과 | v3 PDF p.4 정렬 DSM, p.6 심플 결과 |
| 1:10–2:00 | 개념 | 텍스트와 다이어그램 비교 |
| 2:00–4:15 | 라이브 데모 | ① 시작 → ② 병렬 분기 → ③ 방향 변경 |
| 4:15–6:00 | 실제 과제 | 심플/상세 및 확대, AI 보조와 사람의 검증 |
| 6:00–7:00 | 정리 | 오늘 기억했으면 하는 세 가지 · QR |

- 스크롤하거나 상단 목차를 눌러 이동합니다. 모든 구간은 항상 표시됩니다.
- `#intro`, `#results`, `#concept`, `#demo`, `#case`, `#takeaways`로 구간을 바로 열 수 있습니다. 브라우저 뒤로가기로 이전 앵커로 돌아갈 수 있습니다.
- PageUp/Down과 방향키를 가로채지 않습니다. 편집기에서는 기본 텍스트 편집 동작이 유지됩니다.
- 데모 직접 입력은 300ms 뒤 반영됩니다. 단계 버튼과 초기화는 직접 입력 내용을 프리셋으로 덮어씁니다.
- 오류 시 이전 정상 그림을 유지합니다. ‘↺ 초기화’로 복구합니다. 새로고침하면 1단계로 돌아가며 입력은 저장하지 않습니다.
- 실제 과제의 심플/상세만 내부 버튼으로 전환합니다. ‘크게 보기’ → `＋`/`−`·스크롤, `Esc`로 닫기.
- 전체 화면과 코드 복사 버튼을 제공합니다. 브라우저 권한이 거절되면 안내 메시지를 표시합니다.
- 마무리의 세 가지 메시지는 탭 조작 없이 항상 표시됩니다.
- QR과 외부 출처는 페이지 안에서 보이지만 해당 사이트에 방문하려면 인터넷이 필요합니다.

## 수정·빌드

Node.js 20.19+ 또는 22.12+ 권장. 검증 환경은 24.15.0.

```bash
cd /Users/yenarue/Developers/mini-projects/_tools/mermaid-presentation
npm ci
npm run dev
```

개발 주소: `http://127.0.0.1:5173/`

```bash
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

`dist/index.html`과 모든 로컬 자산을 생성합니다. `http://127.0.0.1:8000/`에서 확인합니다.

```bash
npm run build:site
```

위 명령은 빌드 후 `study/kaist_itm/projects/mermaid-dsm-presentation/`에 페이지·자산·README를 복사합니다. Git push나 원격 배포를 실행하지 않습니다.

GitHub Pages에 저장소 루트를 게시할 경우 경로는 `/mini-projects/study/kaist_itm/projects/mermaid-dsm-presentation/`입니다. 상대 경로이므로 프로젝트 폴더 전체를 다른 정적 서버에 복사해도 작동합니다.

## 구성과 오프라인 동작

- Vite + 바닐라 JavaScript. Mermaid **11.12.0**, QRCode **1.5.4**, Vite **6.4.1** 및 전이 의존성을 lockfile로 고정했습니다.
- `scripts/vendor.mjs`가 npm Mermaid 배포본을 로컬 `public/assets/mermaid.min.js`로 복사합니다. 렌더러는 CDN이 아닌 이 파일에서 로드됩니다. Vite가 classic script를 번들링하지 않는다는 빌드 메시지는 의도한 구성입니다. 최종 `dist/assets/mermaid.min.js` 포함을 확인하세요.
- QR은 로컬 라이브러리로 생성됩니다. 캡처와 폰트 폴백도 로컬에서 동작하며 외부 폰트·AI API·추적 요청이 없습니다.
- Mermaid `securityLevel: strict`, 수동 렌더, 직렬 렌더 큐와 요청 세대 번호를 사용합니다. 과거 렌더가 최신 코드를 덮지 않으며 오류는 텍스트로 안전하게 표시합니다.
- 인터넷을 끊어도 로컬 서버는 계속 실행해야 합니다. 서비스워커나 온라인 페이지의 오프라인 캐시에 의존하지 않습니다.
- Light 모드가 기본이며 다크 모드는 구현하지 않았습니다. 시스템 한글 sans-serif 폴백을 사용하므로 OS에 따라 글꼴은 달라질 수 있습니다.

## 디자인과 원본

- 상단 헤더(2026-10-23): Atlas 공통 KAIST 브랜드와 프로젝트 복귀 링크, 좌측 정렬 메뉴. 활성·호버 탭은 파랑 `#3355d1` / 배경 `#e9edfc`, 본문은 Mermaid 핑크 유지. 모바일에서는 한 줄 헤더 안의 메뉴를 가로 스크롤합니다. 우측 원형 버튼은 전체 화면 전환입니다.


- 레이아웃: 기존 `study/kaist_itm/projects/korea-genai-research-atlas/index.html`의 중립색·14px 카드·헤더·타이포그래피를 발표용으로 재구성.
- 브랜드: [Mermaid 공식 사이트](https://mermaid.js.org/)의 CSS `--vp-c-pink-1: #e0095f`, `--vp-c-pink-2: #b0134a` 확인. 연한 강조면 `#fdebf2`는 발표용 파생색. 공식 사이트를 복제하거나 공식 발표물임을 주장하지 않습니다.
- 원본 PDF: 수업 폴더 `과제/W05_Process_DSM_HW/W05_Process_DSM_HW_플로우차트_20263864_김예나_v3.pdf`. `assets/dsm.png`는 p.4 하단, `simple.png`는 p.6 그림, `detail.png`는 p.7 그림을 실제 원본에서 잘라낸 이미지입니다. 전체 PDF는 복사하지 않았습니다.
- 원본 Mermaid: 같은 폴더의 `W05_Process_DSM_HW_플로우차트_mermaid.md`. `src/cases.js`와 `assets/flowcharts.md`에 보관. [제출 PDF 링크](https://drive.google.com/file/d/1JOZ_ZsAN-FeFeLxfG5Z5Iz1r2LEbulan/view).
- 상세 버전: 상호의존 블록 3개, 직접 관계 25개. SVG 간선은 23개이며 양방향 간선 2개를 각각 두 관계로 계산하면 25개입니다. 시연용 1~3단계 그래프와 구분합니다.
- Mermaid 및 QRCode 라이선스는 `assets/MERMAID-LICENSE.txt`, `assets/QRCODE-LICENSE.txt`에 포함됩니다. Mermaid 배포본에는 전이 라이브러리 고지가 포함되어 있습니다.
- 기획 문서의 정본은 수업 폴더 `세미나/W08_Mermaid/`에 있습니다. 구현 프로젝트의 두 Markdown은 구현 시점 사본입니다.

## 스크롤형 개편 검증 (2026-10-22)

실제 Chromium + Playwright로 **31개 검사 통과**. 제목·5개 본문 구간·목차 이동·데모 3단계·수동 입력·오류 복구·원본 전환·확대·정리 문구를 확인했습니다. 1366×768, 1920×1080, 390×844에서 가로 넘침과 레이아웃을 검사했으며, 세로 스크롤은 의도된 동작입니다.

캐시를 비우고 외부 요청을 차단한 상태에서 로컬 서버의 중첩 경로를 새로 열어 Mermaid와 QR 동작을 검증했습니다. 검증 캡처는 개발 폴더 `output/playwright/`에 보관하며 Git에서는 제외합니다.

Safari·Firefox·Edge 및 실제 교실 프로젝터는 별도 확인이 필요합니다. 정보가 많은 원본 그래프는 확대 보기를 사용하세요. 발표 전 사용 장비로 7분 스크롤 리허설을 권장합니다.


## 9. 다이어그램 갤러리 (2026-10-23)

라이브 데모와 실제 과제 사이에 Flowchart, Sequence, Class, State, ER, Gantt, Mindmap, Timeline, Pie, User Journey 10종을 카드로 배치했다. 카드는 로컬 Mermaid SVG 미리보기와 한 줄 활용 설명을 제공하며, 클릭하면 큰 SVG와 접힌 Mermaid 코드 보기를 연다. 갤러리 상단의 공식 가이드 버튼은 [Mermaid 소개](https://mermaid.js.org/intro/)로 연결하고, 마지막 QR 영역에 [Mermaid 공식 사이트](https://mermaid.js.org/) 링크를 둔다. [Mermaid Live Editor](https://mermaid.live/) 링크는 갤러리와 마지막 영역에서 제공한다. 미리보기와 상호작용은 오프라인에서도 동작한다.

발표 시간은 라이브 데모 2:00–4:15, 갤러리 4:15–5:15, 실제 과제 5:15–6:20, 정리 6:20–7:00으로 조정했다.


## 기본 발표 페이지 통합 (2026-10-25)

기존 v2.0의 전체 내용을 `index.html`로 통합했다. AI + Mermaid 효과와 네 가지 정리를 포함한다. 기존 `index_v2.0.html` 링크는 `location.replace`로 `index.html`로 이동하며 쿼리와 해시(예: `#ai-method`)를 유지한다. JavaScript가 꺼져 있으면 meta refresh로 기본 페이지에 이동하며, 수동 이동 링크도 제공한다.
