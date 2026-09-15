export function hasAccess(req) {
  // ACCESS_CODE가 설정 안 되어 있으면(개발 초기 단계) 항상 통과
  if (!process.env.ACCESS_CODE) return true;
  const cookie = req.headers.cookie || "";
  return cookie.split(";").some((c) => c.trim() === "daiso_access=ok");
}
