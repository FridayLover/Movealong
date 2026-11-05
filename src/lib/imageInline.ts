/**
 * Meta's model service fetches `image_url` references itself, and it cannot
 * fetch many third-party URLs (hotlink-protected CDNs, localhost, expired
 * links) — it answers "URL is not fetchable by this service" and the caller
 * falls back. So before sending any image to Meta we download it server-side
 * and inline it as a base64 data URL, which needs no fetching at all.
 * Data URLs (user uploads) already inline — they pass through untouched.
 */

const MAX_BYTES = 6_000_000; // keep request bodies sane; larger images are skipped, not fatal
const TIMEOUT_MS = 15_000;

export async function toInlineImage(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  if (!/^https?:\/\//i.test(src)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(src, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", Accept: "image/*" },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Inline a list, dropping any image that cannot be fetched (order preserved). */
export async function inlineImages(srcs: string[]): Promise<string[]> {
  const out = await Promise.all(srcs.map((s) => toInlineImage(s)));
  return out.filter((s): s is string => !!s);
}
