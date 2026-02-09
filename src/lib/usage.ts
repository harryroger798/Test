const STORAGE_PREFIX = "rq_usage_";

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getUsageCount(feature: string): number {
  if (typeof window === "undefined") return 0;
  const key = `${STORAGE_PREFIX}${feature}_${getMonthKey()}`;
  return parseInt(localStorage.getItem(key) || "0", 10);
}

export function incrementUsage(feature: string): number {
  if (typeof window === "undefined") return 0;
  const key = `${STORAGE_PREFIX}${feature}_${getMonthKey()}`;
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export function isWithinFreeLimit(feature: string, limit: number): boolean {
  return getUsageCount(feature) < limit;
}

export const FREE_LIMITS = {
  cancelGuides: 3,
  contractScans: 1,
  subscriptions: 3,
} as const;
