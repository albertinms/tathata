import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_DARK_THEME, THEME_KEYS, THEME_STORAGE_KEY } from "@/lib/theme";

import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "本心 Tathata",
  description: "身心靈整合流轉平台",
};

const themeInitScript = `(function(){try{var k=${JSON.stringify(
  THEME_KEYS,
)};var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var t=k.indexOf(s)>-1?s:(matchMedia("(prefers-color-scheme: light)").matches?"c":${JSON.stringify(
  DEFAULT_DARK_THEME,
)});document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
