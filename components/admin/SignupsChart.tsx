"use client";

import { useState } from "react";

/** Sign-ups per day: one series, so no legend (the heading names it). Hover or focus a day for its count;
 *  the same numbers are available as a table. */
export function SignupsChart({ data }: { data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, L = 34, R = 8, T = 12, B = 28;
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const slot = (W - L - R) / data.length, bar = Math.max(2, slot - 2); // 2px surface gap between bars
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const label = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short" });
  const total = data.reduce((a, d) => a + d.count, 0);
  const h = hover === null ? null : data[hover];

  return (
    <div className="grid gap-3">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
          aria-label={`Sign-ups per day for the last ${data.length} days: ${total} in total, at most ${max} in one day.`}
          onMouseLeave={() => setHover(null)}>
          {/* recessive grid */}
          {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{v}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = L + i * slot + 1, by = y(d.count), bh = Math.max(0, y(0) - by);
            const r = Math.min(4, bar / 2, bh);
            return (
              <g key={d.day}>
                {/* the hit target is the whole column, bigger than the mark */}
                <rect x={L + i * slot} y={T} width={slot} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
                {bh > 0 && (
                  <path d={`M${x},${y(0)} V${by + r} Q${x},${by} ${x + r},${by} H${x + bar - r} Q${x + bar},${by} ${x + bar},${by + r} V${y(0)} Z`}
                    fill="var(--route)" opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />
                )}
                {(i % 7 === 0 || i === data.length - 1) && (
                  <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{label(d.day)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div role="status" className="pointer-events-none absolute top-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[.8rem] shadow-[var(--shadow)]"
            style={{ left: `clamp(0px, calc(${((L + hover * slot + slot / 2) / W) * 100}% - 60px), calc(100% - 120px))` }}>
            <div className="text-muted">{label(h.day)}</div>
            <b className="font-mono">{h.count}</b> <span className="text-muted">{h.count === 1 ? "sign-up" : "sign-ups"}</span>
          </div>
        )}
      </div>
      <details className="text-[.85rem]">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full max-w-sm border-collapse font-mono text-[.8rem]">
          <thead><tr><th className="py-1 text-left font-normal text-muted">Day</th><th className="py-1 text-right font-normal text-muted">Sign-ups</th></tr></thead>
          <tbody>{[...data].reverse().map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1">{d.day}</td><td className="py-1 text-right">{d.count}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}
