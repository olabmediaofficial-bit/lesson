# Guitar Lesson Room 배포

이 앱은 Node 서버 하나로 실행됩니다. 정적 파일과 저장 API가 함께 들어 있습니다.

## 로컬 실행

```bash
npm start
```

기본 주소는 `http://localhost:5173` 입니다.

## Render 배포

1. 이 폴더를 GitHub 저장소로 올립니다.
2. Render에서 `New` → `Blueprint`를 선택합니다.
3. 이 저장소를 연결하면 `render.yaml` 설정으로 웹 서비스가 만들어집니다.
4. 환경변수 `ADMIN_PASSWORD`에 관리자 비밀번호를 설정합니다.
5. Supabase에서 무료 프로젝트를 만들고 `SUPABASE_SETUP.sql` 내용을 SQL Editor에서 실행합니다.
6. Supabase Storage에서 public bucket `lesson-files`를 만듭니다.
7. Render 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=lesson-files`를 추가합니다.
8. 배포 후 생긴 Render 주소로 접속합니다.

학생 공유 버튼은 배포 주소를 자동으로 사용합니다.

## 저장 데이터

Supabase 환경변수가 있으면 학생, 블럭, 자료 상태가 Supabase의 `lesson_app_state` 테이블에 저장됩니다. Render 무료 서버가 잠들거나 재배포되어도 데이터는 Supabase에 남습니다.

악보 PNG/JPG/PDF 파일은 Supabase Storage의 `lesson-files` 버킷에 저장되고, 앱 데이터에는 파일 주소만 저장됩니다.

Supabase 환경변수가 없으면 로컬 개발용으로 `data/state.json`에 저장됩니다.

`SUPABASE_SERVICE_ROLE_KEY`는 관리자 서버에서만 쓰는 비밀 키입니다. 브라우저 코드나 공개 문서에 직접 넣지 말고 Render 환경변수에만 저장하세요.

## 주의

학생에게는 `?room=...` 공유 링크만 보내세요. 기본 주소는 관리자 비밀번호가 필요합니다.

로컬에서 별도 비밀번호를 지정하지 않으면 기본 비밀번호는 `lesson-admin` 입니다. 공개 배포에서는 반드시 `ADMIN_PASSWORD`를 다른 값으로 설정하세요.
