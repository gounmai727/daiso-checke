// 다이소 파인더(daiso-finder.kr) 공개 API를 대신 호출해주는 프록시입니다.
// 브라우저에서 직접 daiso-finder.kr을 호출하면 CORS 문제가 생길 수 있어서,
// 우리 서버(Vercel 함수)가 대신 호출하고 결과만 브라우저로 넘겨줍니다.

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";

export default async function handler(req, res) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "접근 권한이 없습니다." });
  }
  const { keyword, page } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: "keyword가 필요합니다." });
  }

  const currentPage = Number(page) || 1;
  const url = `${UPSTREAM}/api/branches/search?keyword=${encodeURIComponent(
    keyword
  )}&currentPage=${currentPage}&pageSize=10`;

  try {
    const upstreamRes = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json(data);
    }

    return res.status(200).json({ stores: data, currentPage });
  } catch (err) {
    return res.status(502).json({ error: "매장 검색 중 오류가 발생했습니다.", detail: String(err) });
  }
}
