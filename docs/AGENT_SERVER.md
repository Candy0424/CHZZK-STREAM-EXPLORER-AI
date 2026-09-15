# LiveScope MCP 도구 서버

웹 탐색기와 같은 PostgreSQL 스냅샷을 AI 호스트가 읽을 수 있도록 MCP stdio 서버를 제공한다. 공식 TypeScript SDK 2.0.0을 사용한다. 자연어 해석·도구 선택은 연결한 AI 호스트가 맡고, 이 서버는 등록된 도구의 입력 검사·조회·결과 반환을 맡는다. 자체 LLM 추론 또는 웹 채팅 기능은 제공하지 않는다.

## 실행과 연결

Node.js 22.12 이상에서 `npm ci` 후 프로젝트 루트에서 `npm run agent`를 실행한다. 표준 입출력은 MCP 메시지 전용이므로 터미널에 대화창이 나타나지 않는 것이 정상이다. 검증 클라이언트는 `npm run agent:verify`로 실행한다.

MCP 호스트에는 다음 형태로 설정한다. 경로는 본인의 절대 경로로 바꾼다. 호스트에는 npm 대신 Node 실행 파일과 tsx CLI를 직접 지정해 npm의 안내 메시지가 프로토콜에 섞이지 않게 한다.

```json
{
  "mcpServers": {
    "livescope": {
      "command": "C:/path/to/node.exe",
      "args": [
        "C:/path/to/project/node_modules/tsx/dist/cli.mjs",
        "C:/path/to/project/scripts/agent-server.ts"
      ],
      "env": { "DEMO_MODE": "false" }
    }
  }
}
```

실제 모드는 프로젝트 `.env.local`의 `DATABASE_URL`과 미리 수집한 DB가 필요하다. 웹/수집은 `npm run dev:live`로 함께 실행한다. MCP는 수집을 강제로 실행하지 않고 저장된 자료만 읽는다. 외부 키 없이 기능을 재현하려면 호스트 환경의 `DEMO_MODE`를 `true`로 지정한다. 명시적으로 지정한 호스트 환경 변수가 `.env.local`보다 우선한다.

## 등록·선택·실행 흐름

1. 호스트가 초기화 후 `tools/list`를 요청한다.
2. 서버가 `registerTool`로 등록한 도구의 이름·설명·JSON 입력 스키마를 반환한다.
3. 호스트는 사용자 요청에 맞는 도구 이름과 인자를 `tools/call`로 보낸다.
4. SDK가 등록 이름으로 실행 함수를 선택하고 Zod 스키마로 입력을 검사한다. 알 수 없는 이름·과도한 페이지 크기·추가 필드를 거부한다.
5. 서버가 공통 조회 로직을 실행하고 `structuredContent`와 텍스트 JSON을 반환한다.

| 사용자 요청 예 | 선택할 도구 | 입력 예 |
| --- | --- | --- |
| 지금 볼 만한 게임 방송 5개 | `search_streamers` | `{"category":"GAME","pageSize":5}` |
| 이 채널이 방송 중인지 확인 | `get_channel_status` | `{"channelId":"32자리 채널 ID"}` |
| 현재 라이브 수와 인기 카테고리 | `get_catalog_stats` | `{}` |

위 표는 호스트 설정 후 사용할 프롬프트 예시이며 LLM 실행 결과를 주장하는 기록이 아니다. 직접 검증한 범위는 아래의 실제 MCP 프로토콜 요청·응답이다.

## 실행 확인: 2026-09-15 09:27 KST

`scripts/verify-agent.ts`가 별도 stdio 프로세스를 실행하고 MCP 클라이언트로 세 도구를 호출했다.

- 도구 목록: `search_streamers`, `get_channel_status`, `get_catalog_stats` 3개 확인.
- 실제 모드 `live`, 최근 동기화 09:23:47 KST, 신선도 `fresh`.
- 누적 카탈로그 6,154개 / 온라인 827개 / 오프라인 5,327개 / 미확인 0개.
- 온라인 3개 검색 후 반환된 첫 채널 ID로 상태 재조회 성공.
- `pageSize:10000` 요청이 입력 검증 오류로 거부됨.
- MCP 프로토콜 테스트 8개 포함 전체 단위·DB 테스트 47개 통과.

수치는 해당 시점의 관측값이며 이후 방송 수는 변한다. MCP 호스트의 실제 모델 추론·자연어 도구 선택은 별도 연동 확인 대상이다.

## 데이터와 오류 처리

모든 도구는 읽기 전용이다. 응답에 `mode`, `freshness`, `lastSuccessfulSync`를 넣어 가상 데이터와 오래된 자료를 구분한다. 미등록 채널은 `found:false`이고 오프라인으로 단정하지 않는다. 온라인 실제 채널만 검증된 공식 링크를 반환한다. DB 오류의 연결 정보는 응답에서 제외한다. 방송 제목·태그는 외부 데이터이며 에이전트 지시문으로 취급하지 않도록 서버 안내에 명시했다.

참고: [MCP 공식 서버 개발 문서](https://modelcontextprotocol.io/docs/develop/build-server), [공식 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
