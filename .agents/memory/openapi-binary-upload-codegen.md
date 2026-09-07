---
name: OpenAPI 바이너리 업로드 코드 생성
description: Orval로 multipart binary 계약을 생성할 때 브라우저와 서버 타입 환경을 함께 맞추는 규칙
---

OpenAPI의 `multipart/form-data` 안에 `format: binary` 필드를 정의하면 React 클라이언트 타입에는 `Blob`, Zod 요청 스키마에는 `File`이 생성된다. 공유 Zod 패키지의 타입 검사 환경은 DOM 타입을 포함해야 한다.

**Why:** 브라우저 클라이언트 생성은 성공해도 Node 중심의 공유 Zod TypeScript 설정에서는 `Blob`과 `File` 이름을 찾지 못해 코드 생성 뒤 빌드가 실패한다. 현재 서버 런타임은 전역 `File`을 지원한다.

**How to apply:** 바이너리 멀티파트 엔드포인트를 추가하거나 런타임 Node 버전을 바꿀 때, 생성 직후 전체 라이브러리 타입 검사와 서버 시작을 함께 확인한다. 서버가 전역 `File`을 제공하지 않는 런타임으로 내려가면 생성된 요청 스키마의 평가 방식도 다시 설계한다.