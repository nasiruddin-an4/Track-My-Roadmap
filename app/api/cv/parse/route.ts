import { aiErrorReply, cvAiConfigured } from "@/lib/cv/ai";
import { fail, json, requireViewer } from "@/lib/cv/api";
import { takeCvQuota } from "@/lib/cv/limits";
import { extractText, parseCvText } from "@/lib/cv/parse";
import { stashUpload } from "@/lib/cv/storage";
import { looksScanned, MAX_CV_CHARS, MAX_UPLOAD_BYTES, MIME_OF, sniffKind } from "@/lib/cv/upload";

/**
 * POST /api/cv/parse   multipart form with `file` (a .pdf or .docx, up to 5 MB)
 *   → { data: CvData, upload: string | null, fileName }
 * Reads the CV into sections for the review screen. Nothing is saved as a CV yet: the original file is kept
 * privately under the person's "pending" folder, and `upload` names it so POST /api/cv can attach it.
 * Each person can import a few CVs a day (lib/cv/limits.ts); files that can't be read don't count.
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  if (!cvAiConfigured()) return fail(503, "Importing a CV isn’t switched on yet. You can start from scratch instead.");
  if (Number(req.headers.get("content-length")) > MAX_UPLOAD_BYTES + 64_000) return fail(413, "That file is over 5 MB. Please upload a smaller PDF or DOCX.");

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail(400, "Please choose a file to upload.");
  }
  if (!file) return fail(400, "Please choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "That file is over 5 MB. Please upload a smaller PDF or DOCX.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes, file.name, file.type);
  if (!kind) return fail(415, "Please upload a PDF or a Word (.docx) file. Older .doc files need saving as .docx first.");

  let text: string;
  try {
    text = (await extractText(kind, bytes)).replace(/\u0000/g, "").trim();
  } catch {
    return fail(422, "We couldn’t open that file. It may be damaged or password-protected. Try saving it again as a PDF.");
  }
  if (kind === "pdf" && looksScanned(text)) return fail(422, "This looks like a scanned CV. Please upload a text PDF or fill in the form.");
  if (!text) return fail(422, "We couldn’t find any text in that file. Please upload another one, or fill in the form.");
  if (text.length > MAX_CV_CHARS) return fail(422, "That file has much more text than a CV usually does. Please upload just your CV.");

  const quota = await takeCvQuota(v.uid, "parse");
  if (!quota.ok) return fail(429, quota.error);

  let data;
  try {
    data = await parseCvText(text);
  } catch (e) {
    const r = aiErrorReply(e, "read that CV");
    console.error("cv parse:", (e as Error).message);
    return fail(r.status, r.error);
  }

  // keep the original privately; if storage isn't set up the import still works, just without the file
  const upload = await stashUpload(v.sb, v.uid, kind, bytes, MIME_OF[kind]);
  return json({ data, upload, fileName: file.name.slice(0, 120), remaining: quota.remaining });
}
