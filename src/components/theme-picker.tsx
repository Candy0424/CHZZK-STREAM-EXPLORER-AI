"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Palette, X } from "lucide-react";
import {
  DEFAULT_THEME,
  normalizeTheme,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

const listeners = new Set<() => void>();

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(normalizeTheme(event.newValue));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  return normalizeTheme(document.documentElement.dataset.theme);
}

function getServerSnapshot() {
  return DEFAULT_THEME;
}

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectTheme(nextTheme: ThemeId) {
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      setSaveFailed(false);
    } catch {
      // The selected palette still works when browser storage is unavailable.
      setSaveFailed(true);
    }
  }

  return (
    <div
      className="theme-picker"
      ref={containerRef}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        className="theme-trigger"
        ref={triggerRef}
        aria-label="테마 선택"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={16} />
        <span>테마</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <section className="theme-panel" id={panelId} aria-label="화면 테마 설정">
          <div className="theme-panel-heading">
            <div>
              <strong>나만의 화면 색상</strong>
              <p>마음에 드는 분위기를 골라보세요.</p>
            </div>
            <button
              className="theme-close"
              aria-label="테마 선택 닫기"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </div>
          <fieldset className="theme-options">
            <legend className="sr-only">화면 테마</legend>
            {THEMES.map((option) => (
              <label className="theme-option" key={option.id}>
                <input
                  type="radio"
                  name={panelId}
                  value={option.id}
                  checked={theme === option.id}
                  onChange={() => selectTheme(option.id)}
                  aria-label={option.name}
                />
                <span className="theme-option-content">
                  <span className="theme-preview" data-theme={option.id} aria-hidden="true">
                    <span className="theme-preview-sidebar" />
                    <span className="theme-preview-main">
                      <i />
                      <span>
                        <b />
                        <b />
                        <b />
                      </span>
                    </span>
                  </span>
                  <span className="theme-option-name">
                    {option.name}
                    {theme === option.id && <Check size={14} aria-hidden="true" />}
                  </span>
                  <span className="theme-option-description">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="theme-save-note" role="status">
            {saveFailed
              ? "테마를 적용했어요. 브라우저 저장이 차단되어 이번 방문에만 유지돼요."
              : "선택한 테마는 이 브라우저에 자동 저장돼요."}
          </p>
        </section>
      )}
    </div>
  );
}
