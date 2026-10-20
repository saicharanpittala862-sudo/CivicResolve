import { randomBytes } from "node:crypto";
import { LocalStorageProvider, type StorageProvider } from "./storageProvider";

/** Facade so a cloud provider can replace local disk without touching routers. */
export const storage: StorageProvider = new LocalStorageProvider(process.env.STORAGE_DIR ?? "./data/uploads");

export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const newKey = (mime: string) => `${randomBytes(16).toString("hex")}.${EXT[mime]}`;
