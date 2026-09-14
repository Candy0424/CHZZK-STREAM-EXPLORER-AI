# 운영과 배포

## 배포 순서

1. Next.js Node 24 서버 실행을 지원하는 호스팅과 PostgreSQL을 준비합니다.
2. 비밀 환경 변수 4개와 `DEMO_MODE=false`를 설정합니다. Client Secret을 `NEXT_PUBLIC_`로 시작하는 변수에 넣지 마세요.
3. `npm ci`, `npm run db:migrate`, `npm run build`를 실행합니다.
4. `npm start`로 서버를 시작합니다. 기본 포트 3000, 필요한 경우 PORT를 설정합니다.
5. 관리 환경에서 `npm run sync`를 실행하고 로그의 COMPLETE를 확인합니다.
6. 저장소 예약 작업을 활성화하고 웹 화면의 마지막 성공 시각을 확인합니다.

이 프로젝트에서 실제 호스팅 생성, 과금 서비스 신청, 인증키 발급은 수행하지 않았습니다. 공개 배포 URL은 확정 후 README에 기록합니다.

## GitHub Actions 예약 동기화

Settings → Secrets and variables → Actions에서 저장소 Secrets `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `DATABASE_URL`, `CRON_SECRET`을 설정합니다. Variables에 `LIVESCOPE_SYNC_ENABLED=true`를 추가합니다. 기본 브랜치의 `Sync official live catalog` 워크플로를 수동 실행해 확인합니다.

워크플로는 앱 HTTP 서버를 거치지 않고 공식 API → PostgreSQL 순으로 직접 실행합니다. 요청마다 최대 20개, 전체 1,000페이지 안전 상한, 실패 시 기존 스냅샷 유지입니다. 작업 최대 실행 시간은 30분입니다. GitHub Actions 예약 시간은 지연될 수 있으며 API Quota와 실행 비용은 실제 운영에서 측정해야 합니다. 활성화 변수 미설정 상태에서는 동기화 작업이 실행되지 않습니다.

호스팅 Cron을 사용하면 HTTPS 내부 동기화 경로에 Bearer 인증을 붙인 POST를 전송합니다. 토큰을 URL 쿼리로 보내지 마세요. HTTP 동기화의 `maxDuration=300`은 호스팅 지원 범위에 따라 제한됩니다. 페이지 수가 많으면 GitHub Actions 또는 상시 프로세스 CLI를 사용합니다. PostgreSQL transaction pooler에서는 세션 advisory lock이 유지되지 않으므로 **세션 연결 또는 직접 DB 연결**을 사용해야 합니다.

## 운영 전 확인

- 실제 치지직 API 라이브 전체 페이지 수 / 호출 시간 / 429 여부 측정
- API Client 권한, 키 주기적 관리, DB TLS/백업/접근 제한 설정
- 최소 20개 실제 채널 상태·URL 비교와 시작/종료 반영 시간 측정
- 일반/모바일 Chrome·Edge, 연령 제한, 없는 이미지, 긴 제목 확인
- 운영 PostgreSQL에서 2개의 CLI를 동시 실행해 LOCKED 응답 확인
- 작업 프로세스 강제 중단 후 DB 연결·advisory lock 해제와 다음 실행 복구 확인
- 장기 운영 시 이력·실행 로그 보관 기간과 비용 결정

## 알려진 한계

전체 페이지 수집은 공식 API가 제공하는 시점별 목록을 순차로 읽습니다. 수집 도중 순위·방송 상태가 바뀌면 페이지 경계 이동으로 누락될 가능성이 있습니다. 페이지 전체 성공은 응답의 완결성 기준이며 원자적 API 스냅샷을 뜻하지 않습니다.

서버는 카탈로그를 캐시해 메모리에서 검색·필터합니다. 카탈로그가 매우 커지면 검색 조건을 SQL로 옮기고 전체 집계를 별도로 캐시해야 합니다. 프론트엔드 쿼리와 링크 이벤트에 대한 대규모 남용 제한은 호스팅의 rate limit/WAF 계층에서 구성합니다.
