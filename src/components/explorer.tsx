"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  ExternalLink,
  Gamepad2,
  Heart,
  LayoutGrid,
  Menu,
  Moon,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Streamer, StreamerResponse } from "@/types/streamer";
import { StreamerCard, elapsed } from "./streamer-card";
import { useFavorites, toggleFavorite as saveFavorite } from "@/lib/favorites";
type View = "explore" | "favorites";
type Status = "all" | "online" | "offline" | "delayed";
const categoryOptions = [
  { id: "all", name: "전체 카테고리", icon: LayoutGrid },
  { id: "GAME", name: "게임", icon: Gamepad2 },
  { id: "ETC", name: "토크 · 음악", icon: AudioLines },
  { id: "SPORTS", name: "스포츠", icon: Trophy },
];
export function Explorer() {
  const [data, setData] = useState<StreamerResponse | null>(null);
  const [settledKey, setSettledKey] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [category, setCategory] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("viewers_desc");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("explore");
  const favorites = useFavorites();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [dialog, setDialog] = useState<"about" | Streamer | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestSequence = useRef(0);
  const params = new URLSearchParams({
    status,
    query: debouncedQuery,
    category,
    categoryId,
    tag,
    sort,
    page: String(page),
  });
  if (view === "favorites") params.set("ids", favorites.join(","));
  const requestKey = `${params}&refresh=${refreshKey}`;
  const loading = requestKey !== settledKey;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((key) => key + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    fetch(`/api/streamers?${requestKey}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        const payload: StreamerResponse = await response.json();
        if (requestSequence.current === sequence) {
          setData(payload);
          setNow(Date.now());
          setError("");
        }
      })
      .catch((reason) => {
        if (reason.name !== "AbortError" && requestSequence.current === sequence)
          setError("목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        if (requestSequence.current === sequence) setSettledKey(requestKey);
      });
    return () => controller.abort();
  }, [requestKey]);
  const toggleFavorite = useCallback((id: string) => {
    const result = saveFavorite(id);
    if (result === "limit") setToast("즐겨찾기는 최대 100개까지 저장할 수 있어요.");
    if (result === "memory") setToast("브라우저 저장소를 사용할 수 없어 현재 창에서만 저장됩니다.");
  }, []);
  function reset() {
    setQuery("");
    setDebouncedQuery("");
    setStatus("all");
    setCategory("all");
    setCategoryId("");
    setTag("");
    setSort("viewers_desc");
    setPage(1);
  }
  function navigate(next: View) {
    setView(next);
    reset();
    setMobileMenu(false);
  }
  function open(streamer: Streamer) {
    if (streamer.demo) {
      setDialog(streamer);
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "channel_open", channelId: streamer.channelId }),
      keepalive: true,
    }).catch(() => {});
  }
  const stale =
    Boolean(error) ||
    data?.freshness === "stale" ||
    Boolean(data?.lastSuccessfulSync && now - Date.parse(data.lastSuccessfulSync) > 900000);
  const counts = data
    ? { ...data.counts, delayed: stale ? data.counts.all : data.counts.delayed }
    : undefined;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => navigate("explore")} aria-label="LiveScope 홈">
          <span className="brand-symbol">
            <Activity size={23} strokeWidth={2.8} />
          </span>
          <span>
            Live<span className="brand-light">Scope</span>
            <small>LIVE STREAM EXPLORER</small>
          </span>
        </button>
        <div className="nav-caption">DISCOVER</div>
        <nav aria-label="주 메뉴">
          <button
            className={`nav-item ${view === "explore" ? "active" : ""}`}
            onClick={() => navigate("explore")}
          >
            <Compass size={19} />
            방송 탐색
            <span className="active-mark" />
          </button>
          <button
            className={`nav-item ${view === "favorites" ? "active" : ""}`}
            onClick={() => navigate("favorites")}
          >
            <Heart size={19} />
            즐겨찾기<span className="nav-count">{favorites.length}</span>
          </button>
        </nav>
        <div className="nav-caption category-caption">CATEGORIES</div>
        <nav aria-label="카테고리">
          {categoryOptions.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item category-nav ${category === id ? "category-selected" : ""}`}
              onClick={() => {
                setCategory(id);
                setCategoryId("");
                setPage(1);
                setMobileMenu(false);
              }}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Radio size={20} />
          </span>
          <h3>좋아하는 방송의 발견</h3>
          <p>
            지금 이 순간, 나에게 맞는
            <br />
            새로운 방송을 만나보세요.
          </p>
          <span className="small-line" />
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setDialog("about")}>
            <CircleHelp size={17} />
            LiveScope 안내
            <ArrowRight size={14} />
          </button>
          <span>Made for your next discovery.</span>
          <small>© 2026 LiveScope</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="메뉴 열기"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            둘러보기<span>/</span>
            <b>{view === "favorites" ? "즐겨찾기" : "방송 탐색"}</b>
          </div>
          <div className="topbar-right">
            <span className="platform-label">
              <i />
              CHZZK
            </span>
            <span className="topbar-divider" />
            <button
              className="help-button"
              onClick={() => setDialog("about")}
              aria-label="서비스 안내"
            >
              <CircleHelp size={19} />
            </button>
            <span className="user-avatar">LS</span>
          </div>
        </header>
        <main id="main">
          <section className="page-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT FAVORITE</span>
              <h1>
                {view === "favorites" ? "나의 즐겨찾기" : "지금, 어떤 방송 볼까"}
                <span className="heading-dot">{view === "explore" ? "?" : "."}</span>
              </h1>
              <p>
                {view === "favorites"
                  ? "좋아하는 방송인들의 소식을 한곳에서 확인하세요."
                  : "취향에 맞는 스트리머를 발견하고, 즐거운 순간에 함께하세요."}
              </p>
            </div>
            <div className="sync-control">
              <span>
                <i className={stale ? "warning-dot" : "green-dot"} />
                {data?.mode === "demo" ? "샘플 미리보기" : "방송 상태 업데이트"}
              </span>
              <div>
                <small>
                  {data?.lastSuccessfulSync
                    ? `${elapsed(data.lastSuccessfulSync, now)} 확인`
                    : "아직 동기화 기록 없음"}
                </small>
                <button
                  disabled={loading}
                  aria-label="목록 새로고침"
                  title="서버에 저장된 최신 목록을 다시 불러옵니다"
                  onClick={() => setRefreshKey((key) => key + 1)}
                >
                  <RefreshCw size={14} className={loading ? "spin" : ""} />
                </button>
              </div>
            </div>
          </section>
          {view === "explore" && (
            <section className="hero-banner">
              <div className="hero-copy">
                <span className="hero-label">
                  <span />
                  DISCOVER SOMETHING NEW
                </span>
                <h2>
                  새로운 즐거움이
                  <br />
                  <em>라이브</em>로 펼쳐지는 곳.
                </h2>
                <p>게임부터 일상까지, 당신의 다음 최애를 찾아보세요.</p>
                <button
                  onClick={() => {
                    setStatus("online");
                    setPage(1);
                    document
                      .getElementById("browse")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  지금 방송 중인 채널
                  <ArrowUpRightIcon />
                </button>
              </div>
              <div className="radar-art" aria-hidden="true">
                <div className="radar-grid" />
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="orbit orbit-three" />
                <div className="radar-cross" />
                <div className="radar-sweep" />
                <div className="radar-center">
                  <Activity size={48} strokeWidth={1.6} />
                </div>
                <span className="signal signal-one" />
                <span className="signal signal-two" />
                <span className="signal signal-three" />
                <div className="floating-tag tag-game">
                  <Gamepad2 size={15} />
                  GAMING
                </div>
                <div className="floating-tag tag-live">
                  <span />
                  ON AIR
                </div>
                <span className="radar-coordinate">37.5665° N · 126.9780° E</span>
              </div>
              <div className="hero-index">LIVE / 001</div>
            </section>
          )}
          <section className="stat-row" aria-label="방송 현황">
            <button
              onClick={() => {
                setStatus("all");
                setPage(1);
              }}
            >
              <span className="stat-icon">
                <Users size={18} />
              </span>
              <span>
                <small>탐색 중인 채널</small>
                <strong>
                  {counts?.all.toLocaleString() ?? "—"}
                  <em>채널</em>
                </strong>
              </span>
            </button>
            <button
              onClick={() => {
                setStatus("online");
                setPage(1);
              }}
            >
              <span className="stat-icon green">
                <Radio size={18} />
              </span>
              <span>
                <small>지금 라이브</small>
                <strong className="green-text">
                  {counts?.online.toLocaleString() ?? "—"}
                  <em>방송 중</em>
                </strong>
              </span>
              <span className="stat-live">LIVE</span>
            </button>
            <button
              onClick={() => {
                setStatus("offline");
                setPage(1);
              }}
            >
              <span className="stat-icon">
                <Moon size={18} />
              </span>
              <span>
                <small>다음 방송 준비 중</small>
                <strong>
                  {counts?.offline.toLocaleString() ?? "—"}
                  <em>오프라인</em>
                </strong>
              </span>
            </button>
            <button
              onClick={() => {
                setStatus("delayed");
                setPage(1);
              }}
            >
              <span className="stat-icon">
                <Activity size={18} />
              </span>
              <span>
                <small>상태 확인 지연</small>
                <strong>
                  {counts?.delayed.toLocaleString() ?? "—"}
                  <em>채널</em>
                </strong>
              </span>
              {counts?.delayed === 0 && <Check size={15} className="stat-check" />}
            </button>
          </section>
          {data?.mode === "demo" && (
            <div className="demo-notice">
              <Zap size={14} />
              <span>
                <b>미리보기 모드</b> 가상 채널과 예시 수치로 구성된 화면입니다. 실제 방송 상태가
                아닙니다.
              </span>
              <button onClick={() => setDialog("about")}>
                자세히
                <ArrowRight size={12} />
              </button>
            </div>
          )}
          {(stale || data?.freshness === "aging") && (
            <div className="delay-notice" role="status">
              <Activity size={17} />
              <span>
                <b>{stale ? "상태 확인이 지연되고 있습니다." : "정보가 지연될 수 있습니다."}</b>{" "}
                마지막으로 확인한 방송 상태를 표시합니다.{" "}
                {data?.lastSuccessfulSync &&
                  `마지막 성공: ${new Date(data.lastSuccessfulSync).toLocaleString("ko-KR")}`}
              </span>
            </div>
          )}
          <section id="browse" className="browse-section" aria-label="방송인 목록">
            <div className="browse-heading">
              <h2>
                {view === "favorites" ? "저장한 방송인" : "방송 둘러보기"}
                <span>{data?.total ?? 0}</span>
              </h2>
              <span className="online-first">
                <span />
                온라인 방송 우선 표시
              </span>
            </div>
            <div className="filter-line">
              <div className="status-tabs" role="group" aria-label="방송 상태">
                {(
                  [
                    { id: "all", label: "전체", count: counts?.all },
                    { id: "online", label: "라이브", count: counts?.online },
                    { id: "offline", label: "오프라인", count: counts?.offline },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={status === item.id}
                    className={status === item.id ? "selected" : ""}
                    onClick={() => {
                      setStatus(item.id);
                      setPage(1);
                    }}
                  >
                    {item.id === "online" && <i />}
                    {item.label}
                    <span>{item.count ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="방송 검색"
                  placeholder="방송인, 방송 제목, 태그 검색"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button aria-label="검색 지우기" onClick={() => setQuery("")}>
                    <X size={15} />
                  </button>
                ) : (
                  <kbd>검색</kbd>
                )}
              </div>
            </div>
            <div className="category-line">
              <div className="category-pills">
                {categoryOptions.map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    aria-pressed={category === id}
                    className={category === id ? "selected" : ""}
                    onClick={() => {
                      setCategory(id);
                      setCategoryId("");
                      setPage(1);
                    }}
                  >
                    <Icon size={14} />
                    {id === "all" ? "전체" : name}
                  </button>
                ))}
              </div>
              <div className="sort-controls">
                <button
                  className={`advanced-button ${advanced ? "selected" : ""}`}
                  aria-label="세부 필터"
                  aria-expanded={advanced}
                  onClick={() => setAdvanced(!advanced)}
                >
                  <SlidersHorizontal size={16} />
                </button>
                <label className="sort-select">
                  <ArrowDownWideNarrow size={15} />
                  <select
                    aria-label="정렬 기준"
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="viewers_desc">시청자 많은 순</option>
                    <option value="started_desc">최근 방송 시작 순</option>
                    <option value="name_asc">채널 이름 순</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
            </div>
            {advanced && (
              <div className="advanced-filters">
                <label>
                  세부 카테고리
                  <select
                    aria-label="세부 카테고리"
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setCategory("all");
                      setPage(1);
                    }}
                  >
                    <option value="">전체</option>
                    {data?.categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  태그
                  <input
                    aria-label="태그 필터"
                    placeholder="예: 힐링"
                    value={tag}
                    onChange={(event) => {
                      setTag(event.target.value);
                      setPage(1);
                    }}
                    maxLength={50}
                  />
                </label>
                <button onClick={reset}>
                  <RefreshCw size={13} />
                  필터 초기화
                </button>
              </div>
            )}
            {error && (
              <div className="error-state" role="alert">
                <p>{error}</p>
                <button onClick={() => setRefreshKey((key) => key + 1)}>다시 시도</button>
              </div>
            )}
            <div className="result-announcement sr-only" aria-live="polite">
              {loading
                ? "방송 목록을 불러오고 있습니다"
                : `${data?.total ?? 0}개의 방송인을 찾았습니다`}
            </div>
            {loading && !data ? (
              <div className="streamer-grid" aria-label="불러오는 중">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="skeleton-card">
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : data?.items.length ? (
              <div className={`streamer-grid ${loading ? "updating" : ""}`} aria-busy={loading}>
                {data.items.map((streamer) => (
                  <StreamerCard
                    key={streamer.channelId}
                    streamer={streamer}
                    favorite={favorites.includes(streamer.channelId)}
                    onFavorite={() => toggleFavorite(streamer.channelId)}
                    onOpen={open}
                    stale={stale}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              !error &&
              !loading && (
                <div className="empty-state">
                  {view === "favorites" ? <Heart size={36} /> : <Search size={36} />}
                  <h3>
                    {view === "favorites" && !favorites.length
                      ? "아직 저장한 방송인이 없어요"
                      : "조건에 맞는 방송인이 없어요"}
                  </h3>
                  <p>
                    {view === "favorites" && !favorites.length
                      ? "방송인 카드의 하트를 눌러 즐겨찾기에 추가해 보세요."
                      : "다른 검색어나 필터로 새로운 방송을 찾아보세요."}
                  </p>
                  <button
                    onClick={() =>
                      view === "favorites" && !favorites.length ? navigate("explore") : reset()
                    }
                  >
                    {view === "favorites" && !favorites.length ? "방송 탐색하기" : "필터 초기화"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )
            )}
            {data && (page > 1 || data.nextPage) && (
              <div className="pagination">
                <button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
                  이전
                </button>
                <span>
                  {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
                </span>
                <button disabled={!data.nextPage || loading} onClick={() => setPage(page + 1)}>
                  다음
                </button>
              </div>
            )}
          </section>
          <footer className="page-footer">
            <span>
              <Activity size={15} />
              <b>LiveScope</b>
              <span>당신의 다음 즐거움을 발견하세요.</span>
            </span>
            <button onClick={() => setDialog("about")}>
              데이터 및 서비스 안내
              <ExternalLink size={12} />
            </button>
            <p>
              오프라인 상태는 이전에 발견하거나 등록한 채널을 기준으로 합니다. LiveScope는 치지직의
              공식 서비스가 아닙니다.
            </p>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="info-dialog"
        onCancel={() => setDialog(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}
        aria-labelledby="dialog-title"
      >
        <button className="dialog-close" aria-label="안내 닫기" onClick={() => setDialog(null)}>
          <X size={20} />
        </button>
        <span className="dialog-logo">
          <Activity size={28} />
        </span>
        <h2 id="dialog-title">
          {dialog && dialog !== "about"
            ? `${dialog.channelName} · 샘플 방송`
            : "LiveScope에 오신 것을 환영해요"}
        </h2>
        {dialog && dialog !== "about" ? (
          <>
            <p>{dialog.liveTitle}</p>
            <p>
              이 채널은 화면 미리보기를 위한 가상 채널입니다. 실제 데이터 모드에서는 라이브 카드를
              누르면 해당 치지직 채널이 새 탭에서 열립니다.
            </p>
          </>
        ) : (
          <>
            <p>
              치지직에서 방송 중인 스트리머를 탐색하고 즐겨찾기에 저장하는 서비스입니다. 즐겨찾기는
              현재 브라우저에 저장됩니다.
            </p>
            <div className="dialog-callout">
              <b>
                {data?.mode === "demo"
                  ? "현재 미리보기 모드입니다"
                  : "관리 카탈로그 기준으로 표시합니다"}
              </b>
              <p>
                {data?.mode === "demo"
                  ? "채널, 시청자 수, 시각은 모두 예시입니다. 공식 API 인증과 데이터베이스를 설정하면 실제 방송을 조회합니다."
                  : "오프라인은 이전에 발견하거나 직접 등록한 채널 중 전체 라이브 동기화에서 발견되지 않은 채널을 의미합니다."}
              </p>
            </div>
            <p>
              전체 페이지 수집이 성공했을 때만 방송 상태를 변경합니다. 수집에 실패하면 기존 상태를
              유지하고 지연을 안내합니다.
            </p>
            <a
              href="https://chzzk.gitbook.io/chzzk/chzzk-api/live"
              target="_blank"
              rel="noopener noreferrer"
            >
              데이터 출처: 치지직 Open API
              <ExternalLink size={13} />
            </a>
          </>
        )}
        <button className="primary-button" onClick={() => setDialog(null)}>
          확인했어요
          <Check size={15} />
        </button>
      </dialog>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
