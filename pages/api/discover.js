// 상품명 검색 시, 실제로 어떤 상품들이 있는지 후보 목록을 보여주기 위한 API입니다.
// 넘겨받은 매장 코드 몇 곳(branchCodes)에서 keyword로 검색해 나온 상품들을
// 품번(id) 기준으로 중복 제거해서 돌려줍니다.
//
// 중요: 매장에 그 상품이 없어서 빈 결과가 온 것과, 다이소 쪽 오류로 확인 자체가
// 실패한 것을 구분해서 sampleErrors로 알려줍니다 (둘 다 "빈 배열"이라 헷갈리기 쉬움).

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";

async function fetchProducts(code, keyword) {
  const url = `${UPSTREAM}/api/products?branchCode=${encodeURIComponent(
    code
  )}&keyword=${encodeURIComponent(keyword)}`;
  // 한 번 실패하면 0.4초 후 한 번 더 시도 (일시적 오류 대응)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.ok) {
        const data = await r.json();
        return { ok: true, products: Array.isArray(data.products) ? data.products : [] };
      }
    } catch (e) {
      // fallthrough to retry
    }
    if (attempt === 0) await new Promise((res) => setTimeout(res, 400));
  }
  return { ok: false, products: [] };
}

export default async function handler(req, res) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "접근 권한이 없습니다." });
  }
  const { branchCodes, keyword } = req.query;

  if (!branchCodes || !keyword) {
    return res.status(400).json({ error: "branchCodes와 keyword가 필요합니다." });
  }

  const codes = branchCodes.split(",").filter(Boolean).slice(0, 10);

  const results = await Promise.all(codes.map((code) => fetchProducts(code, keyword)));

  const sampleErrors = results.filter((r) => !r.ok).length;

  const map = new Map();
  for (const r of results) {
    for (const p of r.products) {
      if (p && p.id && !map.has(p.id)) {
        map.set(p.id, { id: p.id, name: p.name, price: p.price, image: p.image || null });
      }
    }
  }

  return res.status(200).json({
    products: Array.from(map.values()),
    sampleTotal: codes.length,
    sampleErrors,
  });
}
