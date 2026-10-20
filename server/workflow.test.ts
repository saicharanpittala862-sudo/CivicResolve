import { describe, expect, it } from "vitest";
import { canMove, isLegal, isOpen, milestoneIndex, nextStatuses, STATUSES } from "./workflow";
import { similarity, suggest } from "./triage";
import { detectMime, LocalStorageProvider } from "./storageProvider";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("workflow FSM", () => {
  it("allows the happy path and rejects shortcuts", () => {
    const path = ["submitted", "acknowledged", "assigned", "in_progress", "resolved", "closed"];
    for (let i = 0; i < path.length - 1; i++) expect(isLegal(path[i], path[i + 1])).toBe(true);
    expect(isLegal("submitted", "resolved")).toBe(false);
    expect(isLegal("closed", "reopened")).toBe(false);
  });
  it("enforces who may make each move", () => {
    expect(canMove("resolved", "reopened", "citizen")).toBe(true);
    expect(canMove("resolved", "reopened", "officer")).toBe(false);
    expect(canMove("in_progress", "escalated", "system")).toBe(true);
    expect(canMove("in_progress", "escalated", "officer")).toBe(false);
    expect(canMove("resolved", "closed", "citizen")).toBe(false);
    expect(nextStatuses("in_progress", "officer")).toEqual(["resolved"]);
    expect(nextStatuses("closed", "admin")).toEqual([]);
  });
  it("classifies open states and progress-bar stages", () => {
    expect(isOpen("escalated")).toBe(true);
    expect(isOpen("closed")).toBe(false);
    expect(STATUSES.map(milestoneIndex)).toEqual([0, 1, 1, 2, 2, 3, 2, 3]);
  });
});

describe("smart routing", () => {
  it("suggests a category and raises priority for emergencies", () => {
    const s = suggest("Live wire sparking near the school, risk of accident");
    expect(s.priority).toBe("critical");
    expect(suggest("Large pothole on the road").categoryName).toBe("Pothole Repair");
  });
  it("reports zero confidence when nothing matches", () => {
    const s = suggest("hello there");
    expect(s.categoryName).toBeNull();
    expect(s.confidence).toBe(0);
  });
  it("scores near-duplicates above unrelated text", () => {
    expect(similarity("deep pothole on main road", "large pothole on the main road")).toBeGreaterThan(0.3);
    expect(similarity("deep pothole on main road", "garbage dustbin overflow")).toBeLessThan(0.3);
  });
});

describe("storage safety", () => {
  const s = new LocalStorageProvider(fs.mkdtempSync(path.join(os.tmpdir(), "cr-")));
  it("stores files and blocks path traversal", async () => {
    await s.put("abc123.png", Buffer.from("hi"));
    expect((await s.get("abc123.png"))?.toString()).toBe("hi");
    for (const bad of ["../x", "..\\x", "/etc/passwd", "a/../../b", ".hidden", "a/b.png"]) {
      await expect(s.put(bad, Buffer.from("x"))).rejects.toThrow("Invalid storage key");
    }
    await expect(s.put("abc123.png", Buffer.from("again"))).rejects.toThrow();
  });
  it("identifies files by their leading bytes", () => {
    const pad = Buffer.alloc(16);
    expect(detectMime(Buffer.concat([Buffer.from("%PDF-1.7"), pad]))).toBe("application/pdf");
    expect(detectMime(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), pad]))).toBe("image/png");
    expect(detectMime(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), pad]))).toBe("image/jpeg");
    expect(detectMime(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), pad]))).toBe("image/webp");
    expect(detectMime(Buffer.from("<script>alert(1)</script> not an image"))).toBeNull();
    expect(detectMime(Buffer.from("MZ executable header padding padding"))).toBeNull();
  });
});
