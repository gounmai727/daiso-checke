// 특정 매장(branchCode)에 특정 상품(keyword)이 재고가 있는지 확인합니다.
// 다이소 파인더 API는 "그 매장에 현재 재고가 있는 상품"만 돌려주기 때문에,
// 검색 결과가 비어있으면 = 재고 없음으로 판단합니다.

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";

export default async function handler(req, res) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "접근 권한이 없습니다." });
  }
  const { branchCode, keyword } = req.query;

  if (!branchCode || !keyword) {
    return res.status(400).json({ error: "branchCode와 keyword가 모두 필요합니다." });
  }

  const url = `${UPSTREAM}/api/products?branchCode=${encodeURIComponent(
    branchCode
  )}&keyword=${encodeURIComponent(keyword)}`;

  try {
    const upstreamRes = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      // 상위 API 오류는 "확인 불가"로 처리 (재고 없음과는 구분)
      return res.status(200).json({ ok: false, products: [] });
    }

    const products = Array.isArray(data.products) ? data.products : [];
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return res.status(200).json({
      ok: true,
      products,
      totalStock,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, products: [] });
  }
}
