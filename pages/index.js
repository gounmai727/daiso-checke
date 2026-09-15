import { useState, useRef, useEffect } from "react";

// 화면에 보여줄 지역 버튼과, 다이소 파인더가 매장 주소를 검색할 때 쓸 키워드 매핑
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

const MAX_PAGES = 60; // 매장 목록 수집 시 무한루프 방지 (최대 600개 매장)
const CONCURRENCY = 4; // 동시에 확인하는 매장 수 (다이소 파인더 서버에 부담 안 주려고 제한)

async function fetchAllBranches(keyword, onProgress) {
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `/api/branches?keyword=${encodeURIComponent(keyword)}&page=${page}`
    );
    const data = await res.json();
    const stores = data.stores || [];
    all = all.concat(stores);
    onProgress(all.length);
    if (stores.length < 10) break; // 마지막 페이지
  }
  // 매장 코드 기준 중복 제거
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
      if (data.ok) {
        onSuccess();
      } else {
        setError(data.error || "비밀번호가 틀렸습니다.");
      }
    } catch (e) {
      setError("접속 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 320, margin: "80px auto", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>🏬 다이소 재고 확인기</h2>
      <p style={{ color: "#666", fontSize: 14 }}>비밀번호를 입력해주세요</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <button
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 10,
          width: "100%",
          padding: 10,
          background: "#ed1c24",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        {loading ? "확인 중..." : "입장하기"}
      </button>
      {error && <p style={{ color: "#e74c3c", fontSize: 13 }}>{error}</p>}
    </div>
  );
}

export default function Home() {
  const [authed, setAuthed] = useState(null); // null = 확인 중
  const [productKeyword, setProductKeyword] = useState("");
  const [region, setRegion] = useState(REGIONS[0].label);
  const [stage, setStage] = useState("idle"); // idle | collecting | checking | done
  const [stores, setStores] = useState([]); // {code,name,address,openTime,closeTime,stock,checked}
  const [collectedCount, setCollectedCount] = useState(0);
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

  const startScan = async () => {
    if (!productKeyword.trim()) {
      alert("확인할 상품명을 입력해주세요.");
      return;
    }
    cancelRef.current = false;
    setStage("collecting");
    setStores([]);
    setCollectedCount(0);
    setCheckedCount(0);

    const regionInfo = REGIONS.find((r) => r.label === region);
    let branches;
    try {
      branches = await fetchAllBranches(regionInfo.keyword, setCollectedCount);
    } catch (e) {
      alert("매장 목록을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setStage("idle");
      return;
    }

    const initial = branches.map((b) => ({
      code: b.code,
      name: b.name,
      address: b.address,
      openTime: b.openTime,
      closeTime: b.closeTime,
      stock: null, // null = 아직 확인 전
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
          const res = await fetch(
            `/api/stock?branchCode=${encodeURIComponent(
              store.code
            )}&keyword=${encodeURIComponent(productKeyword)}`
          );
          const data = await res.json();
          store.stock = data.ok ? data.totalStock || 0 : 0;
          store.products = data.products || [];
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

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);
    setStage("done");
  };

  const stopScan = () => {
    cancelRef.current = true;
    setStage("done");
  };

  const inStock = stores.filter((s) => s.stock > 0).sort((a, b) => b.stock - a.stock);
  const noStock = stores.filter((s) => s.stock === 0);
  const notYet = stores.filter((s) => s.stock === null);

  return (
    <div className="wrap">
      <header className="header">
        <h1>🏬 다이소 재고 확인기</h1>
        <p>상품명과 지역을 선택하면 매장별 재고를 확인합니다</p>
      </header>

      <div className="panel">
        <div className="field">
          <label>상품명</label>
          <input
            value={productKeyword}
            onChange={(e) => setProductKeyword(e.target.value)}
            placeholder="예: 수세미, 락앤락 밀폐용기"
            disabled={stage === "collecting" || stage === "checking"}
          />
        </div>

        <div className="field">
          <label>지역</label>
          <div className="regionGrid">
            {REGIONS.map((r) => (
              <button
                key={r.label}
                className={r.label === region ? "regionBtn active" : "regionBtn"}
                onClick={() => setRegion(r.label)}
                disabled={stage === "collecting" || stage === "checking"}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="actions">
          {stage === "collecting" || stage === "checking" ? (
            <button className="stopBtn" onClick={stopScan}>
              중지
            </button>
          ) : (
            <button className="startBtn" onClick={startScan}>
              재고 확인 시작
            </button>
          )}
        </div>

        {stage === "collecting" && (
          <p className="status">📍 {region} 지역 매장 목록 수집 중... ({collectedCount}개 발견)</p>
        )}
        {(stage === "checking" || stage === "done") && stores.length > 0 && (
          <p className="status">
            재고 확인: {checkedCount} / {stores.length}개 매장
            {stage === "checking" && " (진행 중...)"}
            {stage === "done" && ` — 재고 있는 매장 ${inStock.length}개`}
          </p>
        )}
      </div>

      {stores.length > 0 && (
        <div className="results">
          {inStock.map((s) => (
            <StoreCard key={s.code} store={s} hasStock />
          ))}
          {stage === "done" &&
            noStock.map((s) => <StoreCard key={s.code} store={s} hasStock={false} />)}
          {notYet.length > 0 && stage === "checking" && (
            <p className="pending">나머지 {notYet.length}개 매장 확인 대기 중...</p>
          )}
        </div>
      )}

      <footer className="footer">
        데이터 출처: 다이소 파인더(daiso-finder.kr) 공개 API · 비공식 서비스이며 실제 매장 재고와 다를 수 있습니다.
      </footer>

      <style jsx>{`
        .wrap {
          max-width: 640px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
          padding-bottom: 40px;
        }
        .header {
          background: #ed1c24;
          color: white;
          padding: 28px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 6px;
          font-size: 22px;
        }
        .header p {
          margin: 0;
          opacity: 0.9;
          font-size: 13px;
        }
        .panel {
          background: white;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }
        .field {
          margin-bottom: 16px;
        }
        .field label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 14px;
          color: #333;
        }
        .field input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 15px;
          box-sizing: border-box;
        }
        .regionGrid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .regionBtn {
          padding: 6px 12px;
          border-radius: 16px;
          border: 1px solid #ccc;
          background: white;
          font-size: 13px;
          cursor: pointer;
        }
        .regionBtn.active {
          background: #ed1c24;
          color: white;
          border-color: #ed1c24;
        }
        .actions {
          margin-top: 8px;
        }
        .startBtn,
        .stopBtn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }
        .startBtn {
          background: #ed1c24;
          color: white;
        }
        .stopBtn {
          background: #666;
          color: white;
        }
        .status {
          margin-top: 12px;
          font-size: 13px;
          color: #555;
        }
        .results {
          padding: 16px 20px;
        }
        .pending {
          text-align: center;
          color: #999;
          font-size: 13px;
          margin-top: 8px;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #aaa;
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
        <div className="hours">
          🕐 {store.openTime} ~ {store.closeTime}
        </div>
      </div>
      <div className="qty">{hasStock ? `${store.stock}개` : "재고 없음"}</div>
      <style jsx>{`
        .card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-left: 4px solid;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 10px;
        }
        .card.ok {
          background: #eafaf1;
          border-left-color: #2ecc71;
        }
        .card.no {
          background: #fdf1f1;
          border-left-color: #e74c3c;
          opacity: 0.7;
        }
        .name {
          font-weight: 700;
          color: #222;
          margin-bottom: 2px;
        }
        .addr {
          font-size: 13px;
          color: #555;
        }
        .hours {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }
        .qty {
          font-weight: 800;
          font-size: 18px;
          color: #2ecc71;
          white-space: nowrap;
        }
        .card.no .qty {
          color: #e74c3c;
          font-size: 13px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
