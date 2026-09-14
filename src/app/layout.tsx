import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LiveScope — 지금, 어떤 방송 볼까?",
  description:
    "치지직 라이브 방송인 탐색기. 방송 상태, 카테고리, 즐겨찾기로 나에게 맞는 새로운 방송을 발견하세요.",
  applicationName: "LiveScope",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
