# 초기 채널 카탈로그

초기 목록은 비어 있습니다. 실제 채널 선정은 사용자가 확인한 채널만 대상으로 하며, 첫 공식 라이브 동기화에서 발견한 채널은 자동 등록됩니다. 가상 UI 샘플은 DB에 등록하지 않습니다.

`seed-channels.json`에 아래 형식으로 추가한 뒤 `npm run channels -- seed`를 실행합니다. 채널 ID는 공식 채널 URL의 32자리 16진수 부분입니다. `source`에는 확인한 공식 채널 URL이나 등록 근거를 남깁니다.

```json
[{ "channelId": "<공식 채널에서 확인한 실제 ID>", "source": "<해당 채널의 공식 URL>" }]
```

프로필 갱신: `npm run channels -- refresh`. API 응답에서 누락된 채널은 `needs_review=true`로 표시하고 기존 상태를 보존합니다. `npm run channels -- review`로 확인합니다.
