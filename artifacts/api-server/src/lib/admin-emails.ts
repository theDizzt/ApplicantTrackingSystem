/**
 * 관리자 권한을 줄 일반 계정 이메일 목록.
 * .env의 ADMIN_EMAILS(쉼표 구분)에 적힌 이메일로 로그인하면 관리자 페이지도 쓸 수 있다.
 * (별도의 관리자 아이디·비밀번호 로그인은 그대로 동작한다)
 */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}
