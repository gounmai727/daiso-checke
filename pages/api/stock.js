// 특정 매장(branchCode)의 "정확히 하나의 상품(productId)" 재고를 확인합니다.
// productId가 없고 keyword만 있는 경우(구버전 호환)에는 이름 검색으로 대체합니다.

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";
const PRODUCT_ID_PATTERN = /^\d{5,12}$/;

export default async function handler(req, res) {
  if (!hasAccess(req)) {
    return res.status(401).json({ error: "접근 권한이 없습니다." });
  }
  const { branchCode, keyword, productId } = req.query;

  if (!branchCode || (!keyword && !productId)) {
    return res.status(400).json({ error: "branchCode와 (productId 또는 keyword)가 필요합니다." });
  }

  const exactId = productId || (PRODUCT_ID_PATTERN.test((keyword || "").trim()) ? keyword.trim() : null);

  try {
    if (exactId) {
      const url = `${UPSTREAM}/api/products/${encodeURIComponent(
        exactId
      )}?branchCode=${encodeURIComponent(branchCode)}`;
      const upstreamRes = await fetch(url, { headers: { Accept: "application/json" } });

      if (upstreamRes.status === 404) {
        return res.status(200).json({ ok: true, products: [], totalStock: 0 });
      }
      if (!upstreamRes.ok) {
        return res.status(200).json({ ok: false, products: [] });
      }

      const data = await upstreamRes.json();
      const stock = Number(data.stock) || 0;
      const products = stock > 0
        ? [{ id: exactId, name: `품번 ${exactId}`, stock, stairNo: data.stairNo, zoneNo: data.zoneNo }]
        : [];

      return res.status(200).json({ ok: true, products, totalStock: stock });
    }

    // 이름 검색 (구버전 호환용 — 여러 상품이 섞일 수 있음)
    const url = `${UPSTREAM}/api/products?branchCode=${encodeURIComponent(
      branchCode
    )}&keyword=${encodeURIComponent(keyword)}`;
    const upstreamRes = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(200).json({ ok: false, products: [] });
    }

    const products = Array.isArray(data.products) ? data.products : [];
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return res.status(200).json({ ok: true, products, totalStock });
  } catch (err) {
    return res.status(200).json({ ok: false, products: [] });
  }
}
