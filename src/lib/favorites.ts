"use client";
import { useSyncExternalStore } from "react";
const empty: string[] = [];
let serialized = "";
let cached = empty;
const listeners = new Set<() => void>();
function read() {
  try {
    const raw = localStorage.getItem("livescope:favorites") ?? "[]";
    if (raw !== serialized) {
      serialized = raw;
      const value: unknown = JSON.parse(raw);
      cached = Array.isArray(value)
        ? value
            .filter((id): id is string => typeof id === "string" && /^[a-f0-9]{32}$/i.test(id))
            .slice(0, 100)
        : empty;
    }
  } catch {
    /* Retain in-memory preferences when storage is unavailable. */
  }
  return cached;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function useFavorites() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
export function toggleFavorite(id: string): "saved" | "limit" | "memory" {
  const previous = read();
  if (!previous.includes(id) && previous.length >= 100) return "limit";
  cached = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
  serialized = JSON.stringify(cached);
  let status: "saved" | "memory" = "saved";
  try {
    localStorage.setItem("livescope:favorites", serialized);
  } catch {
    status = "memory";
  }
  listeners.forEach((listener) => listener());
  return status;
}
