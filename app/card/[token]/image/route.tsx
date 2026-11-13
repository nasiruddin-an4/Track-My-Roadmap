import { ImageResponse } from "next/og";
import { cardRoadmaps, decodeCard, joinedLabel, roadmapCardView, type CardData, type RoadmapCardData } from "@/lib/roadCard";

/* The Road Card as a 1200×630 PNG: the preview image social sites show for a shared card link. */

const W = 1200, H = 630;

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };
let fontsOnce: Promise<Font[]> | null = null;

/** The site's font (Outfit) as TTF for the image renderer; falls back to the built-in font if Google Fonts can't be reached. */
function outfit(): Promise<Font[]> {
  fontsOnce ??= (async () => {
    // without a browser User-Agent, Google Fonts answers with TTF files (the renderer can't read WOFF2)
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700", { signal: AbortSignal.timeout(4000) })).text();
    const faces = [...css.matchAll(/font-weight:\s*(\d+);[^}]*?src:\s*url\((https:[^)]+)\)/g)];
    return Promise.all(faces.map(async ([, w, url]) => ({
      name: "Outfit", weight: Number(w) as Font["weight"], style: "normal" as const,
      data: await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer(),
    })));
  })().catch(() => { fontsOnce = null; return []; });
  return fontsOnce;
}

async function dataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return `data:${r.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const d = decodeCard((await params).token);
  if (!d) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const [logo, avatar, fonts] = await Promise.all([dataUrl(`${origin}/brand/logo-on-dark-solid.png`), d.a ? dataUrl(d.a) : null, outfit()]);
  const art = d.k === "r" ? roadmapCard(d, logo, avatar) : overallCard(d, logo, avatar);
  return new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", padding: "44px 64px", color: "#F1F5F9", fontFamily: fonts.length ? "Outfit" : undefined, border: "2px solid rgba(148,163,184,.2)", borderRadius: 28,
      background: "radial-gradient(circle at 90% 6%, rgba(124,149,255,.28), rgba(124,149,255,0) 52%), linear-gradient(135deg, #111B31, #0A1020)" }}>
      {art}
    </div>,
    { width: W, height: H, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : "")).join("").toUpperCase().slice(0, 2);

function Logo({ logo }: { logo: string | null }) {
  return logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} width={210} height={60} alt="" />
    : <div style={{ fontSize: 26, fontWeight: 700, color: "#FF5A00", letterSpacing: 3 }}>TRACK MY ROADMAP</div>;
}

function Pill({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", background: "#17243A", border: "1px solid #3B4B68", borderRadius: 24 }}>
      <div style={{ width: 9, height: 9, borderRadius: 9, background: "#FF7130" }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: "#D6DEEB", letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 600, color: "#7E8DA5", letterSpacing: 1 }}>
      <span>TRACKMYROADMAP.COM</span>
      <span style={{ color: "#65758D", fontSize: 13, letterSpacing: 1.4 }}>SMALL STEPS. REAL PROGRESS.</span>
    </div>
  );
}

/* ---------- one roadmap ---------- */

function roadmapCard(d: RoadmapCardData, logo: string | null, avatar: string | null) {
  const v = roadmapCardView(d);
  const since = joinedLabel(d.j);
  const finished = v.pct >= 100;
  const accent = finished ? "#43D399" : "#8EA4FF";
  const n = v.states.length;
  const X0 = 16, X1 = 1056; // transit line ends inside the 1072px content width
  const xAt = (i: number) => (n <= 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) * i) / (n - 1));
  const curIdx = v.states.findIndex((x) => x !== "done");
  const R = 96, C = 2 * Math.PI * R;
  const title = v.title.length > 26 ? v.title.slice(0, 25) + "…" : v.title;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* person left, brand right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 84 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 88, height: 88, borderRadius: 999, border: "2px solid #FF7130", background: "#111A2C", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatar} width={80} height={80} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
              : <div style={{ width: 80, height: 80, borderRadius: 999, background: "linear-gradient(135deg,#FF8A3D,#FF5A00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "#fff" }}>{initialsOf(d.n) || "?"}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{d.n.length > 26 ? d.n.slice(0, 25) + "…" : d.n}</div>
            <div style={{ fontSize: 18, color: "#AAB8CC", marginTop: 4 }}>{since ? `Learning since ${since}` : "Learning on Track My Roadmap"}</div>
          </div>
        </div>
        <Logo logo={logo} />
      </div>

      <div style={{ display: "flex", flex: 1, marginTop: 30, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 70 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#AAB8CC", letterSpacing: 2 }}>{finished ? "COMPLETED THE ROADMAP" : "IS LEARNING"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "#17243A", border: "1px solid #3B4B68", borderRadius: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: 8, background: "#FF7130" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#D6DEEB", letterSpacing: 1.2 }}>{v.category === "Skill" ? "SKILL" : "CAREER PATH"}</div>
            </div>
          </div>
          <div style={{ fontSize: title.length > 18 ? 48 : 58, fontWeight: 700, lineHeight: 1.05, marginTop: 8, letterSpacing: -1 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 21, marginTop: 14, color: finished ? "#43D399" : "#C5D2E2" }}>
            {finished ? "Every phase done ✓" : v.current ? `Now on Phase ${v.current.num} of ${n} · ${v.current.title.length > 34 ? v.current.title.slice(0, 33) + "…" : v.current.title}` : ""}
          </div>
          <div style={{ fontSize: 17, marginTop: 10, color: "#8292AA" }}>{`${d.d} of ${d.t} topics · ${v.phasesDone} of ${n} phases`}</div>
        </div>

        <div style={{ display: "flex", width: 240, height: 240, position: "relative", alignItems: "center", justifyContent: "center", marginTop: 32 }}>
          <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", left: 0, top: 0 }}>
            <circle cx="120" cy="120" r={R} fill="#151F32" stroke="#29364B" strokeWidth="18" />
            <circle cx="120" cy="120" r={R} fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round"
              strokeDasharray={`${(C * Math.max(v.pct, 1)) / 100} ${C}`} transform="rotate(-90 120 120)" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1, color: accent }}>{`${v.pct}%`}</div>
            <div style={{ fontSize: 16, color: "#AAB8CC", marginTop: 6 }}>complete</div>
          </div>
        </div>
      </div>

      {/* one stop per phase */}
      <div style={{ display: "flex", position: "relative", height: 74, marginBottom: 18 }}>
        <svg width="1072" height="40" viewBox="0 0 1072 40" style={{ position: "absolute", left: 0, top: 10 }}>
          <line x1={X0} y1="20" x2={X1} y2="20" stroke="#2B3A52" strokeWidth="6" strokeLinecap="round" />
          {v.states.map((st, i) => (i < n - 1 && st === "done"
            ? <line key={"l" + i} x1={xAt(i)} y1="20" x2={xAt(i + 1)} y2="20" stroke="#43D399" strokeWidth="6" />
            : null))}
          {v.states.map((st, i) => st === "done"
            ? <circle key={i} cx={xAt(i)} cy="20" r="11" fill="#43D399" />
            : i === curIdx
              ? <circle key={i} cx={xAt(i)} cy="20" r="13" fill="#0D172A" stroke="#FF7130" strokeWidth="5" />
              : <circle key={i} cx={xAt(i)} cy="20" r="10" fill="#0D172A" stroke={st === "started" ? "#FF9A5C" : "#475569"} strokeWidth="3" />)}
        </svg>
        <div style={{ position: "absolute", left: 0, top: 52, fontSize: 14, color: "#8292AA" }}>Phase 1</div>
        <div style={{ position: "absolute", right: 0, top: 52, fontSize: 14, color: "#8292AA" }}>{`Phase ${n}`}</div>
      </div>

      <Footer />
    </div>
  );
}

/* ---------- everything ---------- */

function overallCard(d: CardData, logo: string | null, avatar: string | null) {
  const top = cardRoadmaps(d);
  const since = joinedLabel(d.j);
  const initials = initialsOf(d.n);
  const stats = [
    [String(d.t), "topics done"],
    [String(d.r), d.r === 1 ? "roadmap" : "roadmaps"],
    [String(d.c), "completed"],
    [`${d.s}d`, "day streak"],
  ];

  return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 50 }}>
          <Logo logo={logo} />
          <Pill label="ROAD CARD" />
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 28, gap: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 544 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 116, height: 116, borderRadius: 999, border: "2px solid #FF7130", background: "#111A2C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {avatar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatar} width={106} height={106} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
                  : <div style={{ width: 106, height: 106, borderRadius: 999, background: "linear-gradient(135deg,#FF8A3D,#FF5A00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700, color: "#fff" }}>{initials || "?"}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>{d.n.length > 20 ? d.n.slice(0, 19) + "…" : d.n}</div>
                <div style={{ fontSize: 19, color: "#AAB8CC", marginTop: 8 }}>{since ? `Learning since ${since}` : "Learning on Track My Roadmap"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-start", padding: "7px 14px", marginTop: 20, background: "#203149", borderRadius: 18 }}>
              <div style={{ width: 8, height: 8, borderRadius: 8, background: "#43D399" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C5D2E2", letterSpacing: 1 }}>LEARNING IN PUBLIC</div>
            </div>
            <div style={{ display: "flex", fontSize: 14, fontWeight: 700, color: "#AAB8CC", letterSpacing: 2, marginTop: 32, paddingBottom: 10, borderBottom: "1px solid #40506A" }}>MILESTONES</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {stats.map(([n, l]) => (
                <div key={l} style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", height: 98, padding: "0 12px", background: "#17243A", border: "1px solid #34445F", borderRadius: 16 }}>
                  <div style={{ width: 22, height: 3, borderRadius: 2, background: "linear-gradient(90deg,#FF8A3D,#FF5A00)", marginBottom: 12 }} />
                  <div style={{ fontSize: 33, fontWeight: 700, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 13, color: "#AAB8CC", marginTop: 8 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: 502, height: 356, display: "flex", flexDirection: "column", alignSelf: "flex-start", background: "#151F32", border: "1px solid #40506A", borderRadius: 25, padding: "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 17, borderBottom: "1px solid #35435A" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#F1F5F9", letterSpacing: 1.5 }}>YOUR ROADMAPS</div>
              <div style={{ fontSize: 12, color: "#8292AA", letterSpacing: 1 }}>{top.length ? `${top.length} IN FOCUS` : "START YOUR JOURNEY"}</div>
            </div>
            {top.length ? top.map((s) => {
              const c = s.pct >= 100 ? "#43D399" : "#8EA4FF";
              return (
                <div key={s.title} style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 21, fontWeight: 600 }}>
                    <span>{s.title.length > 24 ? s.title.slice(0, 23) + "…" : s.title}</span>
                    <span style={{ color: c, fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 5, background: "#29364B" }}>
                    <div style={{ width: `${Math.max(2, s.pct)}%`, height: 8, borderRadius: 5, background: c }} />
                  </div>
                </div>
              );
            }) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 36 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: "#22314A", color: "#FF8A3D", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>+</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 19, fontWeight: 600, color: "#F1F5F9" }}>Your next chapter starts here</div>
                  <div style={{ fontSize: 14, color: "#94A3B8" }}>Choose a roadmap and build momentum.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
  );
}
