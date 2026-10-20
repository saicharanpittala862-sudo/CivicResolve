export const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_FILES = 5;

export function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}
/** Returns a plain-language problem, or null when the file is fine. */
export function checkFile(f: File): string | null {
  if (!ACCEPTED.includes(f.type)) return `${f.name} is not a PDF, PNG, JPG or WebP file.`;
  if (f.size > MAX_BYTES) return `${f.name} is larger than 2 MB.`;
  return null;
}
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
