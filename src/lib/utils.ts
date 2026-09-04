import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function shortHash(h: string, n = 7): string {
  const s = h.replace(/^0x/, "");
  return s.slice(0, n);
}

export function formatKln(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} KLN`;
}

export function syncHash(input: string): string {
  let t = 0;
  for (let i = 0; i < input.length; i++) t = (t * 31 + input.charCodeAt(i)) | 0;
  return `k${Math.abs(t).toString(16).padStart(7, "0")}`;
}
