import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const REGIONS = [
  { label: "서울", keyword: "서울특별시" },
  { label: "경기", keyword: "경기도" },
  { label: "인천", keyword: "인천광역시" },
  { label: "부산", keyword: "부산광역시" },
  { label: "대구", keyword: "대구광역시" },
  { label: "대전", keyword: "대전광역시" },
  { label: "광주", keyword: "광주광역시" },
  { label: "울산", keyword: "울산광역시" },
  { label: "세종", keyword: "세종특별자치시" },
  { label: "강원", keyword: "강원" },
  { label: "충북", keyword: "충청북도" },
  { label: "충남", keyword: "충청남도" },
  { label: "전북", keyword: "전북" },
  { label: "전남", keyword: "전라남도" },
  { label: "경북", keyword: "경상북도" },
  { label: "경남", keyword: "경상남도" },
  { label: "제주", keyword: "제주" },
];

const MAX_PAGES = 60;
const CONCURRENCY = 4;
const DISCOVERY_SAMPLE_SIZE = 8;
const PRODUCT_ID_PATTERN = /^\d{5,12}$/;

async function fetchAllBranches(keyword, onProgress) {
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`/api/branches?keyword=${encodeURIComponent(keyword)}&page=${page}`);
    const data = await res.json();
    const stores = data.stores || [];
    all = all.concat(stores);
    onProgress(all.length);
    if (stores.length < 10) break;
  }
  const seen = new Set();
  return all.filter((s) => {
    if (seen.has(s.code)) return false;
    seen.add(s.code);
    return true;
  });
}

function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) onSuccess();
      else setError(data.error || "비밀번호가 틀렸습니다.");
    } catch (e) {
      setError("접속 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <div className="gate">
      <div className="gateCard">
        <div className="gateIcon">📦</div>
        <h2>DAISO 재고 체커</h2>
        <p>비밀번호를 입력해주세요</p>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={loading}>
          {loading ? "확인 중..." : "입장하기"}
        </button>
        {error && <p className="gateError">{error}</p>}
      </div>
      <style jsx>{`
        .gate {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
        }
        .gateCard {
          background: #1e293b;
          padding: 40px 32px;
          border-radius: 16px;
          width: 280px;
          text-align: center;
        }
        .gateIcon {
          font-size: 36px;
        }
        .gateCard h2 {
          color: #f1f5f9;
          margin: 8px 0 4px;
        }
        .gateCard p {
          color: #94a3b8;
          font-size: 13px;
          margin: 0 0 16px;
        }
        .gateCard input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: #0f172a;
          color: #f1f5f9;
          box-sizing: border-box;
          font-size: 14px;
        }
        .gateCard button {
          width: 100%;
          margin-top: 10px;
          padding: 10px;
          border-radius: 8px;
          border: none;
          background: #6366f1;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
        .gateError {
          color: #f87171;
          font-size: 12px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

function Stepper({ step }) {
  const steps = ["검색어", "상품 선택", "재고 결과"];
  return (
    <div className="stepper">
      {steps.map((label, i) => (
        <div key={label} className={`step ${i + 1 <= step ? "active" : ""}`}>
          <div className="dot">{i + 1}</div>
          <span>{label}</span>
          {i < steps.length - 1 && <div className="line" />}
        </div>
      ))}
      <style jsx>{`
        .stepper {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 20px;
          margin-bottom: 4px;
        }
        .step {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #94a3b8;
          font-size: 12px;
        }
        .step.active {
          color: #1e293b;
          font-weight: 700;
        }
        .dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
        }
        .step.active .dot {
          background: #6366f1;
          color: white;
        }
        .line {
          width: 20px;
          height: 1px;
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [authed, setAuthed] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [region, setRegion] = useState(REGIONS[0].label);
  const [stage, setStage] = useState("idle"); // idle | collecting | discovering | selecting | checking | done
  const [branches, setBranches] = useState([]);
  const [collectedCount, setCollectedCount] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null); // {id, name, price, image} | {id:null, name: keyword} for fallback
  const [stores, setStores] = useState([]);
  const [checkedCount, setCheckedCount] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    fetch("/api/check")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (authed === false) return <PasswordGate onSuccess={() => setAuthed(true)} />;

  const regionInfo = REGIONS.find((r) => r.label === region);

  const beginSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      alert("검색할 상품명 또는 품번을 입력해주세요.");
      return;
    }
    cancelRef.current = false;
    setCandidates([]);
    setSelected(null);
    setStores([]);
    setCheckedCount(0);
    setStage("collecting");
    setCollectedCount(0);

    let list;
    try {
      list = await fetchAllBranches(regionInfo.keyword, setCollectedCount);
    } catch (e) {
      alert("매장 목록을 가져오는 중 오류가 발생했습니다.");
      setStage("idle");
      return;
    }
    setBranches(list);

    if (PRODUCT_ID_PATTERN.test(trimmed)) {
      // 품번 입력 -> 후보 선택 단계 건너뛰고 바로 스캔
      runFullScan(list, { id: trimmed, name: `품번 ${trimmed}` });
      return;
    }

    // 상품명 입력 -> 샘플 매장에서 후보 찾기
    setStage("discovering");
    const sampleCodes = list.slice(0, DISCOVERY_SAMPLE_SIZE).map((s) => s.code);
    if (sampleCodes.length === 0) {
      setStage("selecting");
      setCandidates([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/discover?branchCodes=${sampleCodes.join(",")}&keyword=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      setCandidates(data.products || []);
    } catch (e) {
      setCandidates([]);
    }
    setStage("selecting");
  };

  const runFullScan = async (branchList, product) => {
    setSelected(product);
    const initial = branchList.map((b) => ({
      code: b.code,
      name: b.name,
      address: b.address,
      openTime: b.openTime,
      closeTime: b.closeTime,
      stock: null,
    }));
    setStores(initial);
    setStage("checking");

    let idx = 0;
    let doneCount = 0;

    async function worker() {
      while (idx < initial.length) {
        if (cancelRef.current) return;
        const myIdx = idx++;
        const store = initial[myIdx];
        try {
          const qs = product.id
            ? `productId=${encodeURIComponent(product.id)}`
            : `keyword=${encodeURIComponent(product.name)}`;
          const res = await fetch(`/api/stock?branchCode=${encodeURIComponent(store.code)}&${qs}`);
          const data = await res.json();
          store.stock = data.ok ? data.totalStock || 0 : 0;
        } catch (e) {
          store.stock = 0;
        }
        doneCount++;
        setCheckedCount(doneCount);
        setStores((prev) => {
          const next = [...prev];
          next[myIdx] = { ...store };
          return next;
        });
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    setStage("done");
  };

  const pickCandidate = (c) => runFullScan(branches, c);
  const searchAllMerged = () => runFullScan(branches, { id: null, name: keyword.trim() });

  const stopScan = () => {
    cancelRef.current = true;
    setStage("done");
  };

  const resetSearch = () => {
    cancelRef.current = true;
    setStage("idle");
    setStores([]);
    setCandidates([]);
    setSelected(null);
  };

  const inStock = stores.filter((s) => s.stock > 0).sort((a, b) => b.stock - a.stock);
  const noStock = stores.filter((s) => s.stock === 0);
  const notYet = stores.filter((s) => s.stock === null);

  const step = stage === "idle" ? 1 : stage === "selecting" || stage === "discovering" ? 2 : 3;

  return (
    <div className="app">
      <Head>
        <title>DAISO 재고 체커</title>
      </Head>
      <div className="topbar">
        <div className="brand">DAISO 재고 체커</div>
        {stage !== "idle" && (
          <button className="resetLink" onClick={resetSearch}>
            새 검색
          </button>
        )}
      </div>

      <Stepper step={step} />

      {stage === "idle" && (
        <div className="panel">
          <label className="fieldLabel">상품명 또는 품번</label>
          <input
            className="mainInput"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 도마, 락앤락 밀폐용기, 또는 숫자 품번"
            onKeyDown={(e) => e.key === "Enter" && beginSearch()}
          />

          <label className="fieldLabel">지역</label>
          <div className="chipRow">
            {REGIONS.map((r) => (
              <button
                key={r.label}
                className={r.label === region ? "chip active" : "chip"}
                onClick={() => setRegion(r.label)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button className="primaryBtn" onClick={beginSearch}>
            검색 시작 →
          </button>
        </div>
      )}

      {stage === "collecting" && (
        <div className="panel center">
          <div className="spinner" />
          <p>{region} 지역 매장 목록을 모으고 있어요 ({collectedCount}개 발견)</p>
        </div>
      )}

      {stage === "discovering" && (
        <div className="panel center">
          <div className="spinner" />
          <p>"{keyword}" 상품 후보를 찾고 있어요...</p>
        </div>
      )}

      {stage === "selecting" && (
        <div className="panel">
          <p className="hint">
            "{keyword}"(으)로 여러 상품이 검색될 수 있어요. 정확히 확인할 상품을 골라주세요.
          </p>
          {candidates.length === 0 ? (
            <p className="hint">샘플 매장에서 후보를 찾지 못했어요. 그래도 검색어 그대로 전체를 스캔해볼까요?</p>
          ) : (
            <div className="candList">
              {candidates.map((c) => (
                <button key={c.id} className="candCard" onClick={() => pickCandidate(c)}>
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt={c.name} />
                  ) : (
                    <div className="candImgPlaceholder">📦</div>
                  )}
                  <div className="candInfo">
                    <div className="candName">{c.name}</div>
                    {c.price && <div className="candPrice">{c.price.toLocaleString()}원</div>}
                    <div className="candId">품번 {c.id}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button className="secondaryBtn" onClick={searchAllMerged}>
            원하는 게 없어요 — "{keyword}" 전체로 검색 (여러 상품 합산됨)
          </button>
        </div>
      )}

      {(stage === "checking" || stage === "done") && (
        <>
          <div className="panel">
            <div className="selectedRow">
              <span className="label">확인 중인 상품</span>
              <span className="value">{selected?.name}</span>
            </div>
            <div className="progressBarOuter">
              <div
                className="progressBarInner"
                style={{ width: `${stores.length ? (checkedCount / stores.length) * 100 : 0}%` }}
              />
            </div>
            <p className="hint">
              {checkedCount} / {stores.length}개 매장 확인
              {stage === "checking" && " (진행 중...)"}
              {stage === "done" && ` · 재고 있는 매장 ${inStock.length}곳`}
            </p>
            {stage === "checking" && (
              <button className="secondaryBtn" onClick={stopScan}>
                중지하고 지금까지 결과 보기
              </button>
            )}
          </div>

          <div className="results">
            {inStock.map((s) => (
              <StoreCard key={s.code} store={s} hasStock />
            ))}
            {stage === "done" && noStock.map((s) => <StoreCard key={s.code} store={s} hasStock={false} />)}
            {notYet.length > 0 && stage === "checking" && (
              <p className="pending">나머지 {notYet.length}개 매장 확인 대기 중...</p>
            )}
          </div>
        </>
      )}

      <footer className="footer">
        데이터 출처: 다이소 파인더(daiso-finder.kr) 공개 API · 비공식 서비스이며 실제 매장 재고와 다를 수 있습니다.
      </footer>

      <style jsx global>{`
        body {
          background: #f4f5f9;
          margin: 0;
        }
      `}</style>
      <style jsx>{`
        .app {
          max-width: 600px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
          padding-bottom: 40px;
          color: #1e293b;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 20px 12px;
        }
        .brand {
          font-weight: 800;
          font-size: 17px;
        }
        .resetLink {
          border: none;
          background: none;
          color: #6366f1;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .panel {
          background: white;
          margin: 12px 16px;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .panel.center {
          text-align: center;
          padding: 40px 20px;
        }
        .fieldLabel {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin: 14px 0 6px;
        }
        .fieldLabel:first-child {
          margin-top: 0;
        }
        .mainInput {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          font-size: 15px;
          box-sizing: border-box;
        }
        .mainInput:focus {
          outline: none;
          border-color: #6366f1;
        }
        .chipRow {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .chip {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1.5px solid #e2e8f0;
          background: white;
          font-size: 13px;
          cursor: pointer;
          color: #475569;
        }
        .chip.active {
          background: #eef2ff;
          border-color: #6366f1;
          color: #4338ca;
          font-weight: 700;
        }
        .primaryBtn {
          width: 100%;
          margin-top: 20px;
          padding: 13px;
          border: none;
          border-radius: 10px;
          background: #6366f1;
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .secondaryBtn {
          width: 100%;
          margin-top: 12px;
          padding: 11px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          margin: 0 auto 12px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .hint {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 12px;
        }
        .candList {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .candCard {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: white;
          cursor: pointer;
          text-align: left;
        }
        .candCard:hover {
          border-color: #6366f1;
        }
        .candCard img,
        .candImgPlaceholder {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          object-fit: cover;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .candName {
          font-weight: 700;
          font-size: 14px;
        }
        .candPrice {
          font-size: 13px;
          color: #6366f1;
          font-weight: 600;
        }
        .candId {
          font-size: 11px;
          color: #94a3b8;
        }
        .selectedRow {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .selectedRow .label {
          color: #94a3b8;
        }
        .selectedRow .value {
          font-weight: 700;
        }
        .progressBarOuter {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }
        .progressBarInner {
          height: 100%;
          background: #6366f1;
          transition: width 0.3s;
        }
        .results {
          padding: 4px 16px;
        }
        .pending {
          text-align: center;
          color: #94a3b8;
          font-size: 13px;
          margin-top: 8px;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #cbd5e1;
          padding: 20px;
        }
      `}</style>
    </div>
  );
}

function StoreCard({ store, hasStock }) {
  return (
    <div className={hasStock ? "card ok" : "card no"}>
      <div className="info">
        <div className="name">{store.name}</div>
        <div className="addr">{store.address}</div>
        <div className="hours">🕐 {store.openTime} ~ {store.closeTime}</div>
      </div>
      <div className="qty">{hasStock ? `${store.stock}개` : "품절"}</div>
      <style jsx>{`
        .card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .card.no {
          opacity: 0.55;
        }
        .name {
          font-weight: 700;
          margin-bottom: 2px;
        }
        .addr {
          font-size: 12.5px;
          color: #64748b;
        }
        .hours {
          font-size: 11.5px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .qty {
          font-weight: 800;
          font-size: 15px;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .card.ok .qty {
          background: #dcfce7;
          color: #16a34a;
        }
        .card.no .qty {
          background: #f1f5f9;
          color: #94a3b8;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
