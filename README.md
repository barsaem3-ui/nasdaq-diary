# 나스닥100 매매일기장 by HyunKyu 📈✨

> **"뇌동매매를 극복하고 원칙을 수호하여 트레이더로서의 꿈을 현실로 만듭니다."**

나스닥100 트레이더님의 실수를 보완하고 최고의 매매 평정심을 유지하여 자산을 극대화하기 위해 특별히 고안된 프리미엄 다크 글래스모피즘 매매일기장입니다. PC, 태블릿, 모바일 기기를 완벽히 지원하며, 오프라인(IndexedDB)과 클라우드(Supabase)를 결합한 이중 엔진을 장착하고 있습니다.

---

## 🎨 주요 시각 및 기능적 혁신 (Life-Changing Features)

1. **초고화질 이미지 초고속 붙여넣기 (Ctrl + V)**
   * 복잡한 파일 탐색기 업로드 필요 없이, HTS/MTS 혹은 트레이딩뷰에서 차트 영역을 스크린샷 캡처(`Win + Shift + S` 혹은 `PrintScreen`)한 뒤 **진입/청산 이미지 구역을 클릭하고 바로 `Ctrl + V`**를 누르면 끝입니다!
2. **혁신적인 이미지 용량 자동 압축**
   * 웹 브라우저 자체에서 스크린샷 이미지를 최대 가로 1000px 해상도의 JPEG(화질 70%)로 무손실 수준 압축 처리(Canvas API)합니다. 2~3MB의 고용량 차트 파일이 **40~80KB의 초경량**으로 변환되어 로컬 브라우저와 클라우드 데이터베이스의 저장 공간을 절약하고 로딩 속도를 극대화합니다.
3. **날짜 및 시간 메타데이터 자동 추출**
   * 차트 스크린샷 파일을 업로드할 시, 이미지 파일 자체의 최종 수정 시각을 분석하여 진입/청산 매매 날짜 및 시간을 자동으로 입력해 줍니다.
4. **단점 보완을 위한 '심리 통제 지표' 분석 대시보드**
   * 거래를 기록할 때 **거래 시 심리 상태 태그**(`😊 평온/원칙`, `⚡ 조급함`, `😡 분노/복수매매`, `🤑 탐욕/추격`, `😨 공포/위축`)를 필수로 기록하도록 유도합니다.
   * "원칙 매매 승률"과 "감정 매매 승률"을 개별적으로 연산하여 **"원칙 준수 시 승률이 몇 % 높은지"** 트레이더님의 매매 단점을 명확한 통계 수치와 강력한 조언 메시지로 교정해 줍니다.
5. **골든 룰 (HyunKyu의 5대 매매 수칙) 관리**
   * 대시보드 최상단에 트레이더 본인만의 철칙을 항상 배치하고 수정할 수 있게 하여 뇌동매매 진입 직전 자제력을 찾도록 설계했습니다.
6. **정밀 Nasdaq100 매매 손익 계산 수식 (수수료 $4 반영)**
   * **매수(BUY)**: `((청산포인트 - 진입포인트) * 계약수) - (계약수 * $4)`
   * **매도(SELL)**: `((진입포인트 - 청산포인트) * 계약수) - (계약수 * $4)`
   * 최종 손익이 0 이상(수익)이면 **화려한 적색광 네온(Red)**, 0 미만(손실)이면 **차분한 청색광 네온(Blue)**으로 렌더링됩니다.

---

## ⚡ 즉시 실행 및 사용법

별도의 빌드 도구(`npm install` 등)나 복잡한 컴파일 과정이 필요하지 않은 순수 정적 웹 앱입니다.

1. **로컬 실행**
   * `index.html` 파일을 더블 클릭하여 크롬, 엣지, 사파리 등의 브라우저로 즉시 엽니다.
   * 혹은 VS Code 확장 프로그램인 **Live Server**를 사용하거나 터미널에서 다음 명령어를 실행하여 웹 서버로 실행할 수도 있습니다:
     ```powershell
     # Python 3가 설치되어 있을 경우
     python -m http.server 8000
     ```
     실행 후 브라우저에서 `http://localhost:8000`에 접속합니다.

2. **기본 IndexedDB 모드**
   * 수파베이스를 연동하지 않아도 브라우저 로컬 데이터베이스에 대용량 차트 파일과 일기 데이터가 암호화 백업 안전 저장됩니다. 오프라인에서도 완벽하게 작동합니다.

---

## 💾 Supabase (수파베이스) 실시간 클라우드 동기화 가이드

PC, 스마트폰, 태블릿 PC 간 데이터를 실시간으로 동기화하려면 다음 순서로 연동하십시오:

### 1단계: Supabase 프로젝트 생성
1. [Supabase 공식 홈페이지](https://supabase.com/)에 로그인한 뒤, 새로운 프로젝트를 생성합니다.
2. 프로젝트 대시보드의 **SQL Editor**로 이동하여 아래 SQL 쿼리를 그대로 복사해 붙여넣고 **Run** 버튼을 클릭하여 `trades` 테이블을 생성합니다.

```sql
-- 1. trades 테이블 생성
create table trades (
  id uuid primary key,
  trade_date timestamp with time zone not null,
  position text not null, -- 'BUY', 'SELL'
  conclusion text not null, -- '매수', '매수청산', '매도', '매도청산'
  contracts integer not null default 1,
  entry_point numeric not null,
  exit_point numeric not null,
  entry_tech_reason text,
  entry_psych_reason text,
  exit_tech_reason text,
  exit_psych_reason text,
  entry_image_url text, -- 압축 Base64 데이터 스트링 (Row 저장으로 Storage Bucket 없이 간편 연동)
  exit_image_url text,  -- 압축 Base64 데이터 스트링
  mind_tag text not null default 'disciplined',
  profit_loss numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 고성능 쿼리 및 통계 처리를 위한 인덱스 생성
create index idx_trades_date on trades (trade_date desc);
```

### 2단계: 일기장에 연동 정보 입력
1. 일기장 우측 상단의 ⚙️ **설정** 버튼을 클릭합니다.
2. Supabase 대시보드 `Project Settings -> API`에서 **Project URL**과 **Anon Key**를 확인한 뒤 그대로 입력창에 붙여넣습니다.
3. **설정 저장 및 연결** 버튼을 클릭하면 수초 내에 "수파베이스 클라우드 연결됨" 상태 바가 활성화되며, 로컬에 저장되어 있던 모든 매매일지 데이터가 구름 위 클라우드 데이터베이스로 즉시 동기화 업로드됩니다.

---

## 🌐 깃허브(GitHub) 및 Render(렌더) 배포 가이드

### 1. GitHub Pages 배포
1. 본 프로젝트 폴더의 세 파일(`index.html`, `style.css`, `app.js`)을 깃허브 리포지토리에 커밋 후 업로드합니다.
2. 리포지토리의 `Settings -> Pages` 메뉴로 이동합니다.
3. Build and deployment의 Source를 `Deploy from a branch`로 설정하고 Branch를 `main` (또는 `master`) / `/root`로 선택한 뒤 **Save**를 클릭합니다.
4. 약 1분 후 제공되는 주소(예: `https://username.github.io/repository-name/`)로 전 세계 어디서든 본인만의 고급 매매일기장을 스마트폰과 PC에서 공용 사용할 수 있습니다.

### 2. Render 배포
1. [Render](https://render.com/)에 가입하고 대시보드에서 **New + -> Static Site**를 선택합니다.
2. 깃허브 리포지토리를 연동합니다.
3. Build Command는 빈칸(Blank)으로 두고, Publish Directory를 `./`로 설정하여 배포 버튼을 누릅니다.
4. 즉시 전용 도메인이 제공되며, 수파베이스 서버와 백엔드 통신을 주고받는 멋진 개인 웹 서비스가 완성됩니다.
