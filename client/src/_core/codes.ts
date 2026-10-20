/** Remembers access codes for cases filed on this device, so citizens do not have to retype them. */
const KEY = "cr-access-codes";
function read(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export const getCode = (tn: string) => read()[tn.toUpperCase()] ?? "";
export function saveCode(tn: string, code: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [tn.toUpperCase()]: code })); } catch { /* storage unavailable */ }
}
