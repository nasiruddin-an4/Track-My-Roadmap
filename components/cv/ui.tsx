"use client";

import { useId } from "react";

/* Form pieces for the CV editor, in the app's dark theme. */

export const btnOrange = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-highlight px-4 text-[.92rem] font-semibold whitespace-nowrap text-white transition hover:brightness-110 disabled:opacity-50";
export const inputCls = "h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-[.95rem] text-ink placeholder:text-muted/70 focus:border-route focus:outline-none";
export const iconBtn = "grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={"grid content-start gap-1.5 " + className}>
      <label htmlFor={id} className="text-[.85rem] font-semibold">{label}</label>
      {children(id)}
      {error ? <span className="text-[.8rem] text-danger" role="alert">{error}</span> : hint ? <span className="text-[.8rem] text-muted">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, type = "text", hint, error, className, autoComplete, maxLength = 200 }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string; error?: string;
  className?: string; autoComplete?: string; maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} type={type} className={inputCls + (error ? " border-danger" : "")} value={value ?? ""} placeholder={placeholder}
        autoComplete={autoComplete ?? "off"} maxLength={maxLength} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function TextArea({ label, value, onChange, placeholder, hint, rows = 4, maxLength = 1500, className }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; hint?: string; rows?: number; maxLength?: number; className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <textarea id={id} rows={rows} maxLength={maxLength} className={inputCls + " h-auto py-2.5 leading-relaxed"} value={value ?? ""}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/** Bullet points, one per line. Stored as a list; blank lines are dropped from the CV itself. */
export function BulletsField({ label, value, onChange, placeholder }: { label: string; value?: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <TextArea label={label} rows={4} maxLength={15 * 400} value={(value ?? []).join("\n")} placeholder={placeholder}
      hint="One point per line. Start with a verb, and add a number where you can (e.g. “Cut load time by 40%”)."
      onChange={(v) => onChange(v.split("\n").slice(0, 15).map((l) => l.slice(0, 400)))} />
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month and year as two menus ("YYYY-MM", or "YYYY" with no month). Works the same in every browser. */
export function MonthField({ label, value, onChange, disabled }: { label: string; value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [y, m] = (value ?? "").split("-");
  const now = new Date().getFullYear();
  const years = Array.from({ length: now + 6 - 1970 }, (_, i) => String(now + 5 - i));
  const set = (yy: string, mm: string) => onChange(yy ? (mm ? `${yy}-${mm}` : yy) : "");
  return (
    <Field label={label}>
      {(id) => (
        <div className="flex gap-2">
          <select id={id} aria-label={`${label}: month`} className={inputCls + " flex-1 px-2"} value={m ?? ""} disabled={disabled}
            onChange={(e) => set(y || String(now), e.target.value)}>
            <option value="">Month</option>
            {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
          </select>
          <select aria-label={`${label}: year`} className={inputCls + " flex-1 px-2"} value={y ?? ""} disabled={disabled}
            onChange={(e) => set(e.target.value, m ?? "")}>
            <option value="">Year</option>
            {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>
      )}
    </Field>
  );
}

/** Move up, move down and remove, for one entry in a list. */
export function RowTools({ index, count, onMove, onRemove, what }: { index: number; count: number; onMove: (dir: -1 | 1) => void; onRemove: () => void; what: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${what} up`}>↑</button>
      <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${what} down`}>↓</button>
      <button type="button" className={iconBtn + " hover:text-danger"} onClick={onRemove} aria-label={`Remove ${what}`}>✕</button>
    </div>
  );
}
