import fs from "node:fs";
import path from "node:path";

/** Identify a file by its leading bytes instead of trusting the declared type. */
export function detectMime(b: Buffer): "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | null {
  if (b.length < 12) return null;
  if (b.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Local-disk storage. Keys are validated and resolved paths must stay inside the root. */
export class LocalStorageProvider implements StorageProvider {
  private root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
  }
  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) { await fs.promises.writeFile(this.resolve(key), data, { flag: "wx" }); }
  async get(key: string) {
    try { return await fs.promises.readFile(this.resolve(key)); } catch (e: any) { if (e.code === "ENOENT") return null; throw e; }
  }
}
