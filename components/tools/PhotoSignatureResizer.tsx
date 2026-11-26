"use client";

import { useEffect, useRef, useState } from "react";
import { bytesToBlob, compressCanvas, ctx2d, encode, newCanvas, openImage, readBytes, saveBlob, scaleTo, type Picture } from "@/lib/tools/browser";
import { formatBytes, KB } from "@/lib/tools/files";
import { clampOffset, cleanSignature, coverScale, setJpegDpi } from "@/lib/tools/imageMath";
import { describeSpec, PHOTO_PRESETS, SIGNATURE_PRESETS, type SizeSpec } from "@/lib/tools/presets";
import { DropZone, errorText, Field, inputClass, Notice, ResultCard, Spinner, Toggle } from "./ui";

type Mode = "photo" | "signature";
const MAX_ZOOM = 4;

/** Photo and signature at the exact size and KB limit a form asks for. Each tab keeps its own picture. */
export function PhotoSignatureResizer() {
  const [mode, setMode] = useState<Mode>("photo");
  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label="What are you resizing?" className="grid grid-cols-2 gap-1 rounded-2xl bg-bg/60 p-1 ring-1 ring-line sm:w-fit">
        {(["photo", "signature"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} aria-controls={`panel-${m}`} id={`tab-${m}`} onClick={() => setMode(m)}
            className={"inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-colors "
              + (mode === m ? "bg-surface text-ink shadow-(--shadow-sm) ring-1 ring-line" : "text-muted hover:text-ink")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {m === "photo"
                ? <><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="12" cy="10" r="3" /><path d="M7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5" /></>
                : <path d="M3 17c2-5 4-9 5.5-9 2 0-1.5 9 .5 9 1.5 0 2.5-4 4-4s.5 4 2 4c1 0 2-1.5 3-2.5M3 21h18" />}
            </svg>
            {m === "photo" ? "Photo" : "Signature"}
          </button>
        ))}
      </div>
      <Panel mode="photo" hidden={mode !== "photo"} />
      <Panel mode="signature" hidden={mode !== "signature"} />
    </div>
  );
}

type Custom = { width: string; height: string; maxKB: string; minKB: string };
type Loaded = { pic: Picture; preview: string; name: string };
type Result = { blob: Blob; url: string; fits: boolean };

function parseCustom(c: Custom): SizeSpec | string {
  const w = Number(c.width), h = Number(c.height);
  const max = c.maxKB.trim() ? Number(c.maxKB) : undefined, min = c.minKB.trim() ? Number(c.minKB) : undefined;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 16 || h < 16 || w > 4000 || h > 4000) return "Width and height must be whole numbers from 16 to 4000 pixels.";
  if ((max !== undefined && !(max >= 1 && max <= 20000)) || (min !== undefined && !(min >= 1 && min <= 20000))) return "KB limits must be numbers from 1 to 20000.";
  if (max !== undefined && min !== undefined && min >= max) return "The minimum KB must be less than the maximum.";
  return { width: w, height: h, maxKB: max, minKB: min };
}

function Panel({ mode, hidden }: { mode: Mode; hidden: boolean }) {
  const presets = mode === "photo" ? PHOTO_PRESETS : SIGNATURE_PRESETS;
  const [presetId, setPresetId] = useState(presets[0].id);
  const [custom, setCustom] = useState<Custom>(mode === "photo"
    ? { width: "300", height: "300", maxKB: "100", minKB: "" }
    : { width: "300", height: "80", maxKB: "60", minKB: "" });
  const parsed = presetId === "custom" ? parseCustom(custom) : presets.find((p) => p.id === presetId)!;
  const spec = typeof parsed === "string" ? null : parsed;
  const W = spec?.width ?? 0, H = spec?.height ?? 0, maxKB = spec?.maxKB, minKB = spec?.minKB;

  const [img, setImg] = useState<Loaded | null>(null);
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [clean, setClean] = useState(mode === "signature");
  const [strength, setStrength] = useState(0.5);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useRef(0);
  const resultUrl = useRef<string | null>(null);

  // the picture as turned, and how much it must grow to fill the frame
  const sideways = rot % 180 !== 0;
  const ew = img ? (sideways ? img.pic.height : img.pic.width) : 1;
  const eh = img ? (sideways ? img.pic.width : img.pic.height) : 1;
  const { cover, minZoom } = spec ? coverScale(ew, eh, W, H) : { cover: 1, minZoom: 1 };
  const clampAt = (o: { x: number; y: number }, z: number) => clampOffset(o, (ew * cover * z) / W, (eh * cover * z) / H);

  const resetView = () => { setZoom(1); setOff({ x: 0, y: 0 }); };
  const zoomTo = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(minZoom, z));
    setZoom(next);
    setOff((o) => clampAt(o, next));
  };

  async function choose(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError("");
    try {
      const pic = await openImage(f, 2400);
      // preview drawn from the same pixels the output uses, so what you see is what you get
      const long = Math.max(pic.width, pic.height), k = Math.min(1, 1200 / long);
      const preview = URL.createObjectURL(await encode(scaleTo(pic.source, pic.width, pic.height, pic.width * k, pic.height * k), "image/jpeg", 0.85));
      setImg({ pic, preview, name: f.name });
      setRot(0);
      resetView();
    } catch (e) {
      setError(errorText(e));
    }
  }

  // free a picture once it's replaced or the page closes
  useEffect(() => () => {
    if (img) { img.pic.close(); URL.revokeObjectURL(img.preview); }
  }, [img]);
  useEffect(() => () => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);

  // redraw and re-encode the output a moment after any change
  const ready = spec !== null;
  useEffect(() => {
    if (!img || !ready) return;
    const id = ++run.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const canvas = newCanvas(W, H);
        const ctx = ctx2d(canvas);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, W, H);
        const s = cover * zoom, pic = img.pic;
        const dw = pic.width * s, dh = pic.height * s;
        const src = dw < pic.width / 2 ? scaleTo(pic.source, pic.width, pic.height, dw, dh) : pic.source;
        ctx.translate(W / 2 + off.x * W, H / 2 + off.y * H);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (src !== pic.source && src instanceof HTMLCanvasElement) src.width = 0;
        if (mode === "signature" && clean) {
          const data = ctx.getImageData(0, 0, W, H);
          cleanSignature(data.data, strength);
          ctx.putImageData(data, 0, 0);
        }
        const r = await compressCanvas(canvas, "image/jpeg", {
          maxBytes: maxKB ? maxKB * KB : undefined, minBytes: minKB ? minKB * KB : undefined, canShrink: false,
        });
        const blob = bytesToBlob(setJpegDpi(await readBytes(r.blob), 300), "image/jpeg");
        if (id !== run.current) return;
        const url = URL.createObjectURL(blob);
        const old = resultUrl.current;
        resultUrl.current = url;
        setResult({ blob, url, fits: r.fits });
        setError("");
        if (old) URL.revokeObjectURL(old);
      } catch (e) {
        if (id === run.current) setError(errorText(e));
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [img, ready, W, H, maxKB, minKB, cover, zoom, off.x, off.y, rot, clean, strength, mode]);

  const pickPreset = (id: string) => { setPresetId(id); resetView(); };
  const editCustom = (k: keyof Custom, v: string) => { setCustom((c) => ({ ...c, [k]: v })); resetView(); };
  const turn = (d: number) => { setRot((r) => (r + d + 360) % 360); resetView(); };
  const showResult = result && img && spec;

  return (
    <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`} hidden={hidden}
      className="grid gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="grid content-start gap-4">
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 p-0 font-display text-[1.1rem] font-bold">1. Which form is it for?</legend>
          {[...presets.map((p) => ({ id: p.id, label: p.label, detail: `${describeSpec(p)} · ${p.detail}` })),
            { id: "custom", label: "Custom size", detail: "Type the size from your circular" }].map((p) => (
            <label key={p.id}
              className={"flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-route "
                + (presetId === p.id ? "border-route bg-route-soft/60" : "border-line bg-bg/40 hover:border-muted")}>
              <input type="radio" name={`preset-${mode}`} className="sr-only" checked={presetId === p.id} onChange={() => pickPreset(p.id)} />
              <span aria-hidden="true" className={"mt-0.5 grid size-5 flex-none place-items-center rounded-full border-2 " + (presetId === p.id ? "border-route" : "border-line")}>
                {presetId === p.id && <span className="size-2.5 rounded-full bg-route" />}
              </span>
              <span className="grid gap-0.5">
                <b>{p.label}</b>
                <span className="text-[.86rem] text-muted">{p.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {presetId === "custom" && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-bg/40 p-4">
            <Field label="Width (px)"><input className={inputClass} inputMode="numeric" value={custom.width} onChange={(e) => editCustom("width", e.target.value)} /></Field>
            <Field label="Height (px)"><input className={inputClass} inputMode="numeric" value={custom.height} onChange={(e) => editCustom("height", e.target.value)} /></Field>
            <Field label="Max size (KB)"><input className={inputClass} inputMode="numeric" placeholder="No limit" value={custom.maxKB} onChange={(e) => editCustom("maxKB", e.target.value)} /></Field>
            <Field label="Min size (KB)"><input className={inputClass} inputMode="numeric" placeholder="None" value={custom.minKB} onChange={(e) => editCustom("minKB", e.target.value)} /></Field>
            {typeof parsed === "string" && <p className="col-span-2 m-0 text-[.88rem] text-danger">{parsed}</p>}
          </div>
        )}
        <p className="m-0 text-[.86rem] text-muted">
          Sizes can change from one circular to the next. Check yours, and use Custom if it asks for something different.
        </p>
      </div>

      <div className="grid content-start gap-4">
        <h3 className="m-0 font-display text-[1.1rem] font-bold">2. Add your {mode}</h3>
        {!img ? (
          <DropZone accept="image/*" onFiles={choose} paste
            title={mode === "photo" ? "Choose a photo" : "Choose a signature photo"}
            hint={mode === "photo"
              ? "A clear, front-facing photo. JPG, PNG or WebP; HEIC in Safari."
              : "Sign on white paper with a dark pen, then take a photo of it."} />
        ) : spec && (
          <>
            <Cropper key={img.preview} img={img} W={W} H={H} rot={rot} zoom={zoom} cover={cover} off={off} mode={mode}
              onPan={(dx, dy) => setOff((o) => clampAt({ x: o.x + dx, y: o.y + dy }, zoom))} onZoom={zoomTo} />
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="flex items-center justify-between text-[.88rem] font-semibold text-muted">
                  Zoom <span className="mono">{Math.round(zoom * 100)}%</span>
                </span>
                <input type="range" min={minZoom} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))}
                  className="w-full accent-route" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => turn(-90)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                  Rotate left
                </button>
                <button type="button" className="btn" onClick={() => turn(90)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                  Rotate right
                </button>
                <button type="button" className="btn ghost" onClick={resetView}>Reset</button>
                <label className="btn ghost cursor-pointer">
                  Change picture
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void choose([f]); }} />
                </label>
              </div>
              {mode === "signature" && (
                <div className="grid gap-3 rounded-2xl border border-line bg-bg/40 p-4">
                  <Toggle checked={clean} onChange={setClean}>Clean background (white paper, dark ink)</Toggle>
                  {clean && (
                    <label className="grid gap-1.5">
                      <span className="text-[.86rem] text-muted">Strength: raise it to remove shadows, lower it if thin strokes disappear</span>
                      <input type="range" min={0} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-route" />
                    </label>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {img && !spec && <Notice tone="warn">Fix the custom size to see your {mode}.</Notice>}

        {showResult && (
          <div className="grid gap-4 border-t border-line pt-5">
            <h3 className="m-0 flex items-center gap-2 font-display text-[1.1rem] font-bold">
              3. Download {busy && <Spinner className="text-muted" />}
            </h3>
            <div className="flex flex-wrap items-start gap-4">
              {/* the actual file, shown at its real pixel size (or smaller on narrow screens) */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the student's own file */}
              <img src={result.url} alt={`Your ${mode}, ${W} by ${H} pixels`} width={W} height={H}
                className="h-auto max-w-full rounded-lg bg-white ring-1 ring-line" style={{ width: Math.min(W, mode === "photo" ? 220 : 340) }} />
              <ul className="m-0 grid list-none gap-1.5 p-0 text-[.93rem]">
                <Check ok>{W} × {H} pixels, JPG</Check>
                <Check ok={!maxKB || result.blob.size <= maxKB * KB}>
                  {formatBytes(result.blob.size)}{maxKB ? (result.blob.size <= maxKB * KB ? `, under ${maxKB} KB` : `, over the ${maxKB} KB limit`) : ""}
                </Check>
                {minKB ? <Check ok={result.blob.size >= minKB * KB}>{result.blob.size >= minKB * KB ? `At least ${minKB} KB` : `Under the ${minKB} KB minimum`}</Check> : null}
              </ul>
            </div>
            {!result.fits && (
              <Notice tone="warn">
                {maxKB && result.blob.size > maxKB * KB
                  ? "This picture has too much detail to fit the limit at this size. Zoom in on the important part, or use a photo with a plainer background."
                  : "The form wants a bigger file than this picture makes. Use a sharper, better-lit photo."}
              </Notice>
            )}
            <ResultCard title={`${mode}-${W}x${H}.jpg`} detail={formatBytes(result.blob.size)}
              onDownload={() => saveBlob(result.blob, `${mode}-${W}x${H}.jpg`)} label={`Download ${mode}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={"grid size-5 flex-none place-items-center rounded-full text-bg " + (ok ? "bg-done" : "bg-danger")}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6 6 18" />}
        </svg>
      </span>
      <span className="vh">{ok ? "Meets the requirement:" : "Doesn’t meet the requirement:"}</span>
      {children}
    </li>
  );
}

/** The crop frame, the exact shape of the output. Drag to move, pinch or scroll to zoom, or use the keyboard. */
function Cropper({ img, W, H, rot, zoom, cover, off, mode, onPan, onZoom }: {
  img: Loaded; W: number; H: number; rot: number; zoom: number; cover: number;
  off: { x: number; y: number }; mode: Mode;
  onPan: (dx: number, dy: number) => void; onZoom: (z: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const zoomRef = useRef(zoom);
  const onZoomRef = useRef(onZoom);
  useEffect(() => { zoomRef.current = zoom; onZoomRef.current = onZoom; });

  // scroll to zoom (needs a non-passive listener so the page doesn't scroll too)
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); onZoomRef.current(zoomRef.current * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const down = (e: React.PointerEvent) => {
    frame.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { dist: dist(), zoom };
  };
  const moveP = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const box = frame.current?.getBoundingClientRect();
    if (!prev || !box) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) onPan((e.clientX - prev.x) / box.width, (e.clientY - prev.y) / box.height);
    else if (pinch.current && pointers.current.size === 2) onZoom(pinch.current.zoom * (dist() / pinch.current.dist));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); onPan(...moves[e.key]); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); onZoom(zoom * 1.1); }
    else if (e.key === "-") { e.preventDefault(); onZoom(zoom / 1.1); }
  };

  const widthPct = ((img.pic.width * cover * zoom) / W) * 100;
  return (
    <div className="grid justify-items-center gap-2">
      <div ref={frame} tabIndex={0} role="application"
        aria-label={`Crop area, ${W} by ${H}. Drag to move the picture; arrow keys move it, plus and minus zoom.`}
        onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl bg-white ring-2 ring-route select-none active:cursor-grabbing"
        style={{ aspectRatio: `${W} / ${H}`, maxWidth: mode === "photo" ? Math.min(340, (340 * W) / H) : 560 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the student's own file */}
        <img src={img.preview} alt="" draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: `${50 + off.x * 100}%`, top: `${50 + off.y * 100}%`, width: `${widthPct}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)` }} />
        {mode === "photo" && (
          <span aria-hidden="true"
            className="pointer-events-none absolute top-[10%] left-1/2 h-[62%] w-[56%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(15,23,42,.18)]" />
        )}
      </div>
      <p className="m-0 text-center text-[.84rem] text-muted">
        {mode === "photo" ? "Drag to put your face inside the oval. " : "Drag so the whole signature is inside the frame. "}
        Pinch or scroll to zoom.
      </p>
    </div>
  );
}
