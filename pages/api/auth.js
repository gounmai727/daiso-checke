export default function handler(req, res) {
  const { password } = req.body || {};
  const correct = process.env.ACCESS_CODE;

  if (!correct) {
    // 배포자가 아직 ACCESS_CODE를 설정하지 않은 경우, 일단 통과시켜서 개발/테스트는 가능하게 함
    res.setHeader("Set-Cookie", `daiso_access=ok; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true, warning: "ACCESS_CODE가 설정되지 않았습니다." });
  }

  if (password === correct) {
    res.setHeader("Set-Cookie", `daiso_access=ok; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: "비밀번호가 틀렸습니다." });
}
