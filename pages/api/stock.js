// 특정 매장(branchCode)의 "정확히 하나의 상품(productId)" 재고를 확인합니다.
// productId가 없고 keyword만 있는 경우(구버전 호환)에는 이름 검색으로 대체합니다.
//
// 응답에는 항상 status가 포함됩니다:
//   "in_stock"  - 정상 확인됨, 재고 있음
//   "no_stock"  - 정상 확인됨, 재고 없음 (진짜 품절)
//   "error"     - 확인 실패 (다이소 쪽 오류/타임아웃 등) - 품절과 절대 혼동하면 안 됨

import { hasAccess } from "../../lib/checkAccess";

const UPSTREAM = "https://www.daiso-finder.kr";
const PRODUCT_ID_PATTERN = /^\d{5,12}$/;

async function fetchWithRetry(url, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok || res.status === 404) return res;
      lastErr = new Error(`upstream status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw lastErr;
}

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

      let upstreamRes;
      try {
        upstreamRes = await fetchWithRetry(url);
      } catch (e) {
        return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
      }

      if (upstreamRes.status === 404) {
        return res.status(200).json({ status: "no_stock", ok: true, products: [], totalStock: 0 });
      }
      if (!upstreamRes.ok) {
        return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
      }

      let data;
      try {
        data = await upstreamRes.json();
      } catch (e) {
        return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
      }

      const stock = Number(data.stock) || 0;
      const products = stock > 0
        ? [{ id: exactId, name: `품번 ${exactId}`, stock, stairNo: data.stairNo, zoneNo: data.zoneNo }]
        : [];

      return res.status(200).json({
        status: stock > 0 ? "in_stock" : "no_stock",
        ok: true,
        products,
        totalStock: stock,
      });
    }

    // 이름 검색 (구버전 호환용 — 여러 상품이 섞일 수 있음)
    const url = `${UPSTREAM}/api/products?branchCode=${encodeURIComponent(
      branchCode
    )}&keyword=${encodeURIComponent(keyword)}`;

    let upstreamRes;
    try {
      upstreamRes = await fetchWithRetry(url);
    } catch (e) {
      return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
    }

    if (!upstreamRes.ok) {
      return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
    }

    let data;
    try {
      data = await upstreamRes.json();
    } catch (e) {
      return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
    }

    const products = Array.isArray(data.products) ? data.products : [];
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return res.status(200).json({
      status: totalStock > 0 ? "in_stock" : "no_stock",
      ok: true,
      products,
      totalStock,
    });
  } catch (err) {
    return res.status(200).json({ status: "error", ok: false, products: [], totalStock: 0 });
  }
}
