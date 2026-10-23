# Process DSM HW — 플로우차트 Mermaid 소스

- 정렬 순서: E → H, J → C, D, G → A, I → F → B (X 25개 = 블록 내부 7 + 실선 12 + 점선 6)
- 렌더링: `npx -y @mermaid-js/mermaid-cli -i flow.mmd -o out.png -b white -s 3` (상세버전 하단 범례는 렌더링 후 덧붙임)

## 심플버전
```mermaid
flowchart LR
    E(["E<br/>시작"])

    subgraph HJ["상호의존 블록 ① H·J"]
        direction TB
        H <-->|"상호의존"| J
    end

    subgraph CDG["상호의존 블록 ② C·D·G"]
        direction TB
        C -->|"순환"| D
        D -->|"순환"| G
        G -->|"순환"| C
    end

    subgraph AI["상호의존 블록 ③ A·I"]
        direction TB
        A <-->|"상호의존"| I
    end

    F["F"]
    B(["B<br/>종료"])

    E --> HJ
    HJ --> CDG
    HJ --> AI
    CDG --> F
    AI --> F
    F --> B

    classDef start fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#111
    classDef finish fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef task fill:#ffffff,stroke:#555,color:#111
    class E start
    class B finish
    class H,J,C,D,G,A,I,F task
    style HJ fill:#fef9c3,stroke:#ca8a04,stroke-width:2px
    style CDG fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style AI fill:#ede9fe,stroke:#7c3aed,stroke-width:2px
```

## 상세버전
```mermaid
%%{init: {"flowchart": {"nodeSpacing": 70, "rankSpacing": 70}, "themeCSS": ".edge-pattern-dotted { stroke-dasharray: 8 6 !important; }"}}%%
flowchart TB
    E(["E<br/>시작"])

    subgraph HJ["상호의존 블록 ① H·J"]
        H["H"]
        J["J"]
    end

    subgraph CDG["상호의존 블록 ② C·D·G"]
        C["C"]
        D["D"]
        G["G"]
    end

    subgraph AI["상호의존 블록 ③ A·I"]
        A["A"]
        I["I"]
    end

    F["F"]
    B(["B<br/>종료"])

    %% 굵은 선: 블록 내부 (X 7개)
    H <==> J
    A <==> I
    C ==> D
    D ==> G
    G ==> C

    %% 실선: 바로 다음 단계로 가는 직접 입력 (12개)
    E --> H
    E --> J
    H --> C
    J --> D
    J --> G
    J --> A
    H --> I
    C --> F
    D --> F
    G --> F
    A --> F
    F --> B

    %% 점선: 단계를 건너뛰는 직접 입력 (6개)
    E -.-> D
    E -.-> A
    H -.-> B
    C -.-> B
    A -.-> B
    I -.-> B

    classDef start fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#111
    classDef finish fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef task fill:#ffffff,stroke:#555,color:#111
    class E start
    class B finish
    class H,J,C,D,G,A,I,F task
    style HJ fill:#fef9c3,stroke:#ca8a04,stroke-width:2px
    style CDG fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style AI fill:#ede9fe,stroke:#7c3aed,stroke-width:2px

    linkStyle 0,1,2,3,4 stroke:#b45309,stroke-width:3px
    linkStyle 5,6,7,8,9,10,11,12,13,14,15,16 stroke:#333,stroke-width:1.8px
    linkStyle 17,18,19,20,21,22 stroke:#6b7280,stroke-width:2px
```
