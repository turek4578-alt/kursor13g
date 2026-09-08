import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OKPAYS — обмен криптовалют",
  description: "USDT, ETH, BTC, SOL, TON. Курс фиксируется на 15 минут.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "KURS" },
};

export const viewport = {
  themeColor: "#0b0f0d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
