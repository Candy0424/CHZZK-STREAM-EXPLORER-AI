export const CHANNEL_ID_PATTERN = /^[a-f0-9]{32}$/i;
export function channelUrl(id: string): string | null {
  return CHANNEL_ID_PATTERN.test(id) ? `https://chzzk.naver.com/${id}` : null;
}
export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/art/")) return value;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
