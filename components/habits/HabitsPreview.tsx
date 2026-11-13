import { Check } from "@/components/icons";

/* A small, non-interactive picture of the habit tracker, built from its own styles. */

const ROWS: [string, boolean][] = [
  ["😴 Wake up early", true], ["💧 Drink 2 glasses of water", true], ["🏋️ Light exercise", true],
  ["📚 Programming study", true], ["📖 Read 10–15 pages", false], ["🎯 Plan tomorrow", false],
];
const BARS = [.5, .67, .83, 1, .67, .83, 1, .5, .83, 1, 1, .67];

export function HabitsPreview() {
  const rc = 2 * Math.PI * 27, pct = 0.68;
  return (
    <div inert aria-hidden="true" className="relative select-none">
      <div className="absolute inset-x-0 -inset-y-6 -z-10 rounded-[40px] sm:-inset-6 bg-[radial-gradient(60%_60%_at_30%_30%,rgba(67,211,153,.16),transparent_70%)]" />
      <div className="grid gap-3 rounded-[22px] border border-line bg-bg p-4 shadow-[var(--shadow)]">
        <div className="box today !p-4">
          <div className="box-h"><h2 className="!text-[1.1rem]">Today</h2><span className="meta">4 of 6 done</span></div>
          <div className="tbar"><i style={{ width: "67%" }} /></div>
          <div className="rows !grid-cols-1 sm:!grid-cols-2">
            {ROWS.map(([name, on]) => (
              <label key={name} className="row !min-h-10">
                <input type="checkbox" defaultChecked={on} tabIndex={-1} />
                <span className="cb"><Check /></span><span className="rl !text-[.92rem]">{name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5">
            <div className="pring !size-14">
              <svg viewBox="0 0 64 64">
                <circle className="trk" cx="32" cy="32" r="27" fill="none" strokeWidth="7" />
                <circle className="val" cx="32" cy="32" r="27" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={rc.toFixed(2)} strokeDashoffset={(rc * (1 - pct)).toFixed(2)} />
              </svg>
              <b className="!text-[.75rem]">68%</b>
            </div>
            <div className="grid"><span className="eyebrow">This month</span><span className="font-display font-semibold">Goal 540</span></div>
          </div>
          <div className="grid content-end gap-2 rounded-[18px] border border-line bg-surface p-3.5">
            <span className="eyebrow">Daily progress</span>
            <div className="flex h-12 items-end gap-1">
              {BARS.map((b, i) => <i key={i} className={"block flex-1 rounded-[3px] " + (b === 1 ? "bg-done" : "bg-route")} style={{ height: b * 100 + "%" }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
