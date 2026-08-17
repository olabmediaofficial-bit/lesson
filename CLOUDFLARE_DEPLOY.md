# Cloudflare 이전 메모

이 앱은 Cloudflare Pages Functions + D1 + R2로 배포할 수 있습니다.

## Cloudflare 구성

- Pages project: `guitar-lesson-room`
- D1 database: `lesson-db`
- R2 bucket: `lesson-files`
- D1 binding: `LESSON_DB`
- R2 binding: `LESSON_FILES`

## 필요한 Cloudflare 환경변수

Cloudflare Pages 프로젝트의 Settings > Environment variables에 아래 값을 넣습니다.

- `ADMIN_PASSWORD`: 관리자 로그인 비밀번호
- `TOKEN_SECRET`: 긴 임의 문자열
- `PUBLIC_ORIGIN`: 배포 주소. 예: `https://guitar-lesson-room.pages.dev`

## 빌드 설정

- Build command: `npm run build:cloudflare`
- Build output directory: `public`

## D1 스키마

`schema.sql`을 D1에 적용합니다.

```bash
npx wrangler d1 execute lesson-db --file schema.sql
```

## 기존 데이터 이전

Supabase에서 받은 상태 JSON 파일을 D1 import SQL로 바꿉니다.

```bash
node scripts/state-to-d1-sql.js supabase-state.json cloudflare-state-import.sql
npx wrangler d1 execute lesson-db --file cloudflare-state-import.sql
```

## 파일 저장

새로 올리는 PNG/JPG/PDF 파일은 R2 `lesson-files` 버킷에 저장됩니다.
앱에서는 `/files/...` 주소로 파일을 보여줍니다.

이미 Supabase Storage URL로 옮겨진 기존 악보는 계속 표시됩니다. 나중에 완전히 R2로 옮기려면 앱의 `기존 악보 옮기기` 버튼 또는 별도 마이그레이션을 사용합니다.
