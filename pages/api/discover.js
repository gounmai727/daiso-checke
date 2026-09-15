// 상품명 검색 시, 실제로 어떤 상품들이 있는지 후보 목록을 보여주기 위한 API입니다.
// 넘겨받은 매장 코드 몇 곳(branchCodes)에서 keyword로 검색해 나온 상품들을
// 품번(id) 기준으로 중복 제거해서 돌려줍니다.

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";

export default async function handler(req, res) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "접근 권한이 없습니다." });
  }
  const { branchCodes, keyword } = req.query;

  if (!branchCodes || !keyword) {
    return res.status(400).json({ error: "branchCodes와 keyword가 필요합니다." });
  }

  const codes = branchCodes.split(",").filter(Boolean).slice(0, 10);

  const lists = await Promise.all(
    codes.map(async (code) => {
      try {
        const url = `${UPSTREAM}/api/products?branchCode=${encodeURIComponent(
          code
        )}&keyword=${encodeURIComponent(keyword)}`;
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data.products) ? data.products : [];
      } catch {
        return [];
      }
    })
  );

  const map = new Map();
  for (const list of lists) {
    for (const p of list) {
      if (p && p.id && !map.has(p.id)) {
        map.set(p.id, { id: p.id, name: p.name, price: p.price, image: p.image || null });
      }
    }
  }

  return res.status(200).json({ products: Array.from(map.values()) });
}
