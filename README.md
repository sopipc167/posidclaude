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
- `db.js` — Postgres 연결 및 스키마 (`pg` 사용)
- `server.js` — 로컬 개발용 진입점 (`api/index.js`를 불러와 정적 파일까지 같이 서빙)
- `public/` — 프론트엔드 (직원 페이지, 관리자 페이지)

## Vercel 배포

이 앱은 Postgres(서버리스 환경에서도 동작)를 사용하도록 만들어져 있어 Vercel에 바로 배포할 수 있습니다.

1. [vercel.com](https://vercel.com) 에서 GitHub 계정으로 로그인
2. **Add New → Project** → 이 저장소(`posidclaude`) 선택 → **Deploy**
3. 프로젝트 대시보드 → **Storage** 탭 → **Create Database** → **Postgres** 선택 후 프로젝트에 연결
   - 연결하면 `POSTGRES_URL` 등 환경변수가 자동으로 설정됩니다 (직접 만들 필요 없음)
4. **Settings → Environment Variables**에서 `ADMIN_PASSWORD` 추가 (관리자 페이지 로그인 암호)
5. 다시 배포(Redeploy)하면 완료. `https://your-project.vercel.app` 링크를 직원들에게 공유하면 됩니다.

첫 요청이 들어올 때 테이블이 자동으로 생성되므로 별도 마이그레이션은 필요 없습니다.

## 로컬 실행

Vercel CLI로 실행하면 프로덕션과 동일한 라우팅/환경변수로 테스트할 수 있습니다:

```bash
npm install -g vercel
vercel link       # 이 프로젝트와 연결
vercel env pull .env.development.local   # Vercel의 POSTGRES_URL 등을 로컬로 가져옴
vercel dev
```

또는 일반 Node 서버로 실행하려면 `.env` 파일에 Postgres 접속 정보를 넣고 실행합니다:

```bash
echo "POSTGRES_URL=postgres://user:password@localhost:5432/giftapp" > .env
npm install
npm start
```

## 환경변수

| 변수 | 설명 |
|---|---|
| `POSTGRES_URL` | Postgres 접속 문자열 (Vercel Postgres 연결 시 자동 설정) |
| `ADMIN_PASSWORD` | 관리자 페이지 로그인 암호 (기본값 `admin1234`, 배포 시 꼭 변경) |
| `PORT` | 로컬 실행 시 서버 포트 (기본 `3000`, Vercel에서는 사용 안 함) |

## 데이터 초기화

관리자 페이지에서 각 제안을 개별 삭제할 수 있습니다. 전체 초기화가 필요하면 Vercel의 Storage 탭에서
Postgres 데이터베이스의 `gifts`, `votes` 테이블 내용을 직접 비우면 됩니다.
