# 웹 공개용 데이터 사전

- 대상 파일: `atlas-data.json`, `projects.csv`
- 생성일: 2026-10-01 KST
- 분석 단위: 다년도 연차를 연결한 대표 프로젝트 721개
- 기간: 2023~2026년, 2026년은 YTD

## 1. 공개 원칙

HTML에는 지도·차트·프로젝트 탐색에 필요한 최소 필드만 공개한다. 연구목표·연구내용·기대효과 원문, 사업자등록번호, 연락처, 내부 관련성 판정과 표본 검토 로그는 제외한다. 연구책임자명은 NTIS 과제의 공개 책임자 정보이며, 별도의 연락처·연구실 정보와 결합하지 않는다.

`series_id`는 `이전과제고유번호` 체인의 최초 NTIS 과제 ID다. `ntis_url`은 이 ID를 NTIS 과제 검색어로 넣은 검색 URL이며, 특정 상세 페이지의 영구 링크임을 보장하지 않는다.

## 2. JSON 최상위 구조

| 키 | 자료형 | 설명 |
|---|---|---|
| `meta` | object | 제목, 갱신일, 기간, YTD 연도, 건수, 출처, 공개 범위 설명 |
| `summaries` | object | 연도·시도·시군구·기관·기술 주제·적용 영역 집계 |
| `projects` | array | 대표 프로젝트 721개 |

## 3. 프로젝트 필드

| 필드 | 자료형 | 결측 허용 | 정의 |
|---|---|---:|---|
| `series_id` | string | 아니오 | 다년도 연결 체인의 대표 NTIS 과제 ID |
| `title` | string | 아니오 | 대표 과제명 |
| `pi` | string | 아니오 | 대표 연구책임자명 |
| `institution` | string | 아니오 | 정규화 수행기관명 |
| `site` | string | 예 | 캠퍼스·교정·분원. 구분이 필요할 때만 값 존재 |
| `institution_type` | string | 아니오 | 정규화 기관 유형 |
| `sido` | string | 아니오 | 대표 수행기관 소재 시도 |
| `sigungu` | string | 아니오 | 대표 수행기관 소재 시군구 |
| `region_key` | string | 아니오 | 행정구역 결합 키: `시도 시군구` |
| `start_year` | integer | 아니오 | 분석 범위 안 첫 포함 연도 |
| `end_year` | integer | 아니오 | 분석 범위 안 마지막 포함 연도 |
| `included_years` | integer[] | 아니오 | 포함된 연도 목록 |
| `included_record_count` | integer | 아니오 | 연결된 포함 연도별 레코드 수 |
| `government_funding_krw` | integer | 아니오 | 연결된 포함 레코드의 정부투자연구비 합계, 원 |
| `total_funding_krw` | integer | 아니오 | 연결된 포함 레코드의 연구비합계, 원 |
| `research_field` | string | 아니오 | 최신 포함 레코드의 NTIS 1순위 연구분야 |
| `application_field` | string | 아니오 | 최신 포함 레코드의 NTIS 1순위 적용분야 |
| `matched_terms` | string[] | 아니오 | 세 검색 패스에서 확인된 핵심 검색어 |
| `technical_topic` | string | 아니오 | 규칙 기반 기술 접근 대표 주제군 1개 |
| `application_domain` | string | 아니오 | 규칙 기반 적용 영역 대표 주제군 1개 |
| `ntis_url` | string | 아니오 | `series_id`를 이용한 NTIS 과제 검색 URL |

CSV는 배열 필드인 `included_years`와 `matched_terms`를 ` | `로 연결해 저장하며, 나머지 필드의 의미는 JSON과 같다.

## 4. 집계 필드

- `annual`: 연도별 활성 프로젝트, 신규 프로젝트, 정부 연구비, 총연구비, YTD 여부
- `regions`: 시도별 프로젝트 수·비중·정부 연구비
- `districts`: 시군구 결합 키별 프로젝트 수·비중·정부 연구비
- `institutions`: 정규화 기관별 프로젝트 수·비중·정부 연구비
- `technical_topics`: 기술 접근 주제군별 프로젝트 수·비중·정부 연구비
- `application_domains`: 적용 영역 주제군별 프로젝트 수·비중·정부 연구비

연도 집계의 연구비는 연도별 레코드 기준이며, 프로젝트·지역·기관·주제 집계의 연구비는 대표 프로젝트에 연결된 포함 연도 금액의 합계다. 동일 프로젝트가 같은 집계에서 두 번 더해지지 않도록 대표 프로젝트 단위로 계산했다.

## 5. 주제군 해석

기술 접근은 6개, 적용 영역은 8개 대표값을 갖는다. 제목을 우선하고 최신 포함 연도의 키워드를 보조로 사용한다. 적용 영역은 둘 다 미적중일 때 NTIS 공식 적용분야를 보조로 사용한다.

한 과제가 여러 주제를 가질 수 있지만 웹 필터를 위해 우선순위상 처음 적중한 하나를 대표값으로 저장했다. 따라서 주제군은 탐색과 구성비 비교를 위한 규칙 기반 분류이지, 상호배타적인 공식 학문 분류가 아니다. 전체 규칙과 62개 표본 검토 결과는 `ntis_genai_eda_with_topics.xlsx`의 `Topic Taxonomy`, `Topic Assignments`, `Topic Review` 시트에 있다.

## 6. 검증 결과

- 프로젝트 721개, `series_id` 고유값 721개, 중복 0건
- 필수 공개 필드 결측 0건
- CSV 데이터 행 721개
- 정부 연구비 합계 161,441,480,666원
- 총연구비 합계 174,078,884,666원
- 이메일 형식 문자열 0건
- 전화번호·연락처 필드 없음
- 연구목표·연구내용·기대효과 원문과 사업자등록번호 필드 없음
