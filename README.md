# 창립 기념일 선물 취합

직원들이 원하는 창립 기념일 선물을 제안하고, 등록된 제안에 투표할 수 있는 웹앱입니다.
관리자는 별도 페이지에서 결과를 집계·정렬해서 보고, CSV로 내보낼 수 있습니다.

## 기능

- **직원 페이지 (`/`)**: 이름/부서 입력 후 선물 제안 등록, 등록된 제안에 투표(추천)
  - 한 사람이 여러 제안에 투표 가능, 같은 제안에는 1회만(다시 누르면 취소)
- **관리자 페이지 (`/admin.html`)**: 암호 로그인 후
  - 총 제안 수 / 총 투표 수 / 참여 인원 / 최다 득표 선물 요약
  - 득표순 정렬 목록, 부적절한 제안 삭제
  - CSV 내보내기

## 구조

- `api/index.js` — API 라우트를 담은 Express 앱 (Vercel 서버리스 함수로 배포됨)
- `db.js` — MongoDB 연결 (공식 `mongodb` 드라이버)
- `server.js` — 로컬 개발용 진입점 (`api/index.js`를 불러와 정적 파일까지 같이 서빙)
- `public/` — 프론트엔드 (직원 페이지, 관리자 페이지)

## MongoDB Atlas 준비 (Vercel/Render 공통)

1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) 가입 후 무료 클러스터(M0) 생성
2. **Database Access**에서 사용자 계정 생성 (아이디/비밀번호)
3. **Network Access**에서 `0.0.0.0/0` 허용 (Vercel/Render 같은 클라우드 서비스는 고정 IP가 아니므로 전체 허용 필요)
4. **Connect → Drivers**에서 연결 문자열 복사 (`mongodb+srv://사용자:비밀번호@...`)

이 연결 문자열을 아래 `MONGODB_URI` 환경변수로 사용합니다. 데이터베이스/컬렉션과 인덱스는 앱이 처음 요청을 처리할 때 자동으로 만들어지므로 별도 설정이 필요 없습니다.

## Vercel 배포

1. [vercel.com](https://vercel.com) 에서 GitHub 계정으로 로그인
2. **Add New → Project** → 이 저장소(`posidclaude`) 선택 → **Deploy**
3. **Settings → Environment Variables**에 추가:
   - `MONGODB_URI`: 위에서 복사한 Atlas 연결 문자열
   - `ADMIN_PASSWORD`: 관리자 페이지 로그인 암호
4. 다시 배포(Redeploy)하면 완료. `https://your-project.vercel.app` 링크를 직원들에게 공유하면 됩니다.

## Render 배포

1. Render 대시보드 → **New + → Web Service** → 이 저장소 연결
2. **Environment**를 **Node**로 선택 (Docker 아님)
3. Build Command: `npm install`, Start Command: `npm start`
4. Environment Variables에 `MONGODB_URI`, `ADMIN_PASSWORD` 추가

## 로컬 실행

```bash
echo "MONGODB_URI=mongodb+srv://사용자:비밀번호@..." > .env
echo "ADMIN_PASSWORD=원하는암호" >> .env
npm install
npm start
```

Vercel CLI로 실행하면 프로덕션과 동일한 라우팅/환경변수로 테스트할 수 있습니다:

```bash
npm install -g vercel
vercel link
vercel env pull .env.development.local
vercel dev
```

## 환경변수

| 변수 | 설명 |
|---|---|
| `MONGODB_URI` | MongoDB 연결 문자열 (Atlas의 Connect → Drivers에서 복사) |
| `MONGODB_DB` | 사용할 데이터베이스 이름 (기본값 `giftapp`) |
| `ADMIN_PASSWORD` | 관리자 페이지 로그인 암호 (기본값 `admin1234`, 배포 시 꼭 변경) |
| `PORT` | 로컬 실행 시 서버 포트 (기본 `3000`, Vercel에서는 사용 안 함) |

## 데이터 초기화

관리자 페이지에서 각 제안을 개별 삭제할 수 있습니다. 전체 초기화가 필요하면 MongoDB Atlas 대시보드에서
`giftapp` 데이터베이스의 `gifts`, `votes` 컬렉션을 직접 비우면 됩니다.
