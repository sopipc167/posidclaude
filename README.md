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

## 로컬 실행

```bash
npm install
npm start
```

기본 포트는 3000번이며 `http://localhost:3000` 에서 확인할 수 있습니다.

## 환경변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `PORT` | 서버 포트 | `3000` |
| `ADMIN_PASSWORD` | 관리자 페이지 로그인 암호 | `admin1234` (배포 시 꼭 변경하세요) |
| `DB_PATH` | SQLite 파일 경로 | `./data.db` |

## 배포 (Render 예시)

이 앱은 SQLite(`better-sqlite3`)로 파일에 데이터를 저장하는 **상시 구동 Node 서버**이므로,
Render, Railway, Fly.io처럼 지속적인 디스크가 있는 서비스에 적합합니다.

1. GitHub 저장소를 Render에 연결
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment → `ADMIN_PASSWORD` 값을 원하는 암호로 설정
5. (권장) Render의 "Persistent Disk"를 추가하고 `DB_PATH`를 해당 디스크 경로로 지정하면
   재배포 후에도 데이터가 유지됩니다. 디스크를 추가하지 않으면 재배포 시 데이터가 초기화될 수 있습니다.

> Vercel처럼 서버리스(파일시스템이 매 요청마다 초기화되는) 환경에는 이 구성 그대로는 배포할 수 없습니다.
> Vercel을 꼭 써야 한다면 `db.js`를 Postgres(예: Vercel Postgres, Neon) 등 외부 DB로 교체해야 합니다.

## 데이터 초기화

`data.db` 파일을 삭제하면 모든 제안/투표 기록이 초기화됩니다.
