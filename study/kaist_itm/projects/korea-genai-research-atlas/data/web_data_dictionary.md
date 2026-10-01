# 웹 공개용 데이터 사전

- 대상 파일: `atlas-data.json`, `projects.csv`
- 생성일: 2026-10-01 KST
- 분석 단위: 다년도 연차를 연결한 대표 프로젝트 1,151개
- 기간: 2023년~2026년 9월 30일, 2026년은 YTD

## 1. 공개 원칙

HTML에는 지도·차트·프로젝트 탐색에 필요한 최소 필드와 텍스트 분석의 파생 결과만 공개한다. 연구목표·연구내용·기대효과 원문, 사업자등록번호, 연락처, 내부 관련성 판정과 표본 검토 로그는 제외한다. 연구책임자명은 NTIS 과제의 공개 책임자 정보이며 별도의 연락처·연구실 정보와 결합하지 않는다.

`series_id`는 `이전과제고유번호` 체인의 최초 NTIS 과제 ID다. `ntis_url`은 이 ID를 NTIS 과제 검색어로 넣은 URL이며 특정 상세 페이지의 영구 링크임을 보장하지 않는다.

## 2. JSON 최상위 구조

| 키 | 자료형 | 설명 |
|---|---|---|
| `meta` | object | 제목, 갱신일, 기간, YTD 연도, 건수, 출처, 공개 범위 설명 |
| `summaries` | object | 연도·지역·기관·규칙 기반 주제·탐색 분석 집계 |
| `projects` | array | 대표 프로젝트 1,151개 |

## 3. 프로젝트 필드

| 필드 | 자료형 | 정의 |
|---|---|---|
| `series_id` | string | 다년도 연결 체인의 대표 NTIS 과제 ID |
| `title` | string | 대표 과제명 |
| `pi` | string | 대표 연구책임자명 |
| `institution`, `site`, `institution_type` | string | 정규화 수행기관, 캠퍼스·분원, 기관 유형 |
| `sido`, `sigungu`, `region_key` | string | 대표 수행기관 소재 행정구역 |
| `start_year`, `end_year` | integer | 분석 범위 안 첫·마지막 포함 연도 |
| `included_years` | integer[] | 포함된 연도 목록 |
| `included_record_count` | integer | 연결된 포함 연도별 레코드 수 |
| `government_funding_krw` | integer | 포함 레코드의 정부투자연구비 합계, 원 |
| `total_funding_krw` | integer | 포함 레코드의 연구비합계, 원 |
| `research_field`, `application_field` | string | 최신 포함 레코드의 NTIS 1순위 공식 분류 |
| `matched_terms` | string[] | 검색 패스와 대표 행에서 확인된 핵심 검색어 |
| `technical_topic` | string | 규칙 기반 기술 접근 대표 주제군 |
| `application_domain` | string | 규칙 기반 적용 영역 대표 주제군 |
| `ntis_url` | string | `series_id`를 이용한 NTIS 과제 검색 URL |
| `cluster_id` | integer | 0~13의 탐색 군집 ID |
| `cluster_label` | string | 대표 키워드와 표본 검토로 붙인 임시 군집명 |
| `map_x`, `map_y` | number | t-SNE 2차원 좌표. 축 자체에는 의미가 없음 |
| `representative_keywords` | string[] | 과제명과 등록 키워드에서 뽑은 대표어 최대 6개 |
| `similar_projects` | object[] | 텍스트 코사인 유사도 상위 5개 `series_id`와 `similarity` |

CSV는 배열 필드를 ` | `로 연결하고 유사 프로젝트 ID와 유사도를 별도 열로 저장한다.

## 4. 집계 필드

- `annual`: 연도별 활성·신규 프로젝트, 연구비, YTD 여부
- `regions`, `districts`: 시도·시군구별 프로젝트 수·비중·연구비
- `institutions`: 정규화 기관별 프로젝트 수·비중·연구비
- `technical_topics`, `application_domains`: 규칙 기반 주제군 집계
- `exploration.meta`: 텍스트 특징 수, SVD, 선택 k, 실루엣, 안정도, 지도 이웃 보존율, Security 교차주제 점검 결과, 해석 주의
- `exploration.candidate_metrics`: k=6~14 후보별 실루엣·안정도·군집 크기
- `exploration.keywords`: 전체 상위 키워드와 연도별 특징 키워드
- `exploration.clusters`: 14개 군집의 규모·연구비·대표 키워드·기관·주제 구성·대표 과제 ID

## 5. 탐색 분석 방법과 한계

- 입력: 대표 과제명, 한글·영문 키워드, 연구목표요약, 연구내용요약
- 표현: 단어 1~2그램 TF-IDF 75% + 문자 3~5그램 TF-IDF 25%
- 축소: Truncated SVD 64차원
- 군집: K-means k=6~14 비교, 선택 k=14
- 유사도: 결합 TF-IDF의 코사인 유사도
- 지도: 고정 난수 시드의 t-SNE 2차원 좌표
- 품질: k=14 실루엣 0.124, 여러 초기값 안정도 ARI 0.611
- 지도 이웃 보존율@5: 22.7%. 고차원 코사인 이웃 5개 중 2차원에서도 최근접 5개에 남은 비율
- Security 교차주제: 198개가 14개 군집 모두에 분포. 군집 4에는 24개(22.4%)

군집은 공식 학문 분류가 아니며, 안정도가 중간 수준이어서 경계 프로젝트는 실행 조건에 따라 다른 군집으로 이동할 수 있다. Security는 하나의 군집으로 강제하지 않고 기존 규칙 기반 `안전·신뢰·거버넌스` 주제군을 지도 위 교차주제로 강조한다. 2차원 좌표는 고차원 관계의 손실 있는 투영이므로 축이나 절대 거리에 의미를 부여하지 않는다. 전역 지도의 연결선은 코사인 유사도 상위 5개를 가리키지만 선 길이는 유사도 크기가 아니다. 정확한 유사도 크기는 별도 코사인 관계도와 수치로 읽는다. 키워드에는 한글·영문 동의어와 형태 변형, 일부 서술어가 함께 남을 수 있다.

## 6. 검증 결과

- 프로젝트 1,151개, `series_id` 고유값 1,151개, 중복 0건
- 군집·좌표 누락 0건
- 프로젝트별 유사 연구 5개, 존재하지 않는 ID 0건, 자기 자신 연결 0건
- CSV 데이터 행 1,151개
- 정부 연구비 합계 367,039,636,666원
- 총연구비 합계 400,348,959,166원
- 연구목표·연구내용·기대효과 원문과 사업자등록번호·연락처 필드 없음
