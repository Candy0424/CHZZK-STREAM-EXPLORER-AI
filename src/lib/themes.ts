export const THEMES = [
  { id: "cloud", name: "클라우드", description: "밝은 화이트 · 블루" },
  { id: "midnight", name: "미드나잇", description: "차분한 네이비 · 블루" },
  { id: "lavender", name: "라벤더", description: "부드러운 다크 · 퍼플" },
  { id: "sand", name: "샌드", description: "따뜻한 아이보리 · 브라운" },
  { id: "forest", name: "포레스트", description: "기존 다크 · 그린" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "cloud";
export const THEME_STORAGE_KEY = "livescope.theme";

export function normalizeTheme(value: string | null | undefined): ThemeId {
  return THEMES.find((theme) => theme.id === value)?.id ?? DEFAULT_THEME;
}

// Run before the first paint so a saved dark theme never flashes light on reload.
// Only static, allowlisted identifiers are interpolated into this script.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEMES.map((theme) => theme.id))}.indexOf(t)!==-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
