import type { Metadata, Viewport } from "next";
import { Newsreader, JetBrains_Mono, Noto_Serif_JP } from "next/font/google";
import { cookies } from "next/headers";
import { BrandDot } from "@/components/brand-dot";
import { Masthead } from "@/components/masthead";
import { LocaleProvider } from "@/components/locale-provider";
import { RegisterSW } from "@/components/register-sw";
import { OfflineBadge } from "@/components/offline-badge";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

const newsreaderFont = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-jbm",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const jpSerifFont = Noto_Serif_JP({
  variable: "--font-jp-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Shosetu Reader",
  description: "Calm web reader for Syosetu novels with resume and translation flows.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
};

type ThemeValue = "paper" | "sepia" | "night" | "system";

function readThemeCookie(value: string | undefined): ThemeValue {
  if (value === "paper" || value === "sepia" || value === "night" || value === "system") {
    return value;
  }
  return "system";
}

function readGlossaryCookie(value: string | undefined): "show" | "hide" {
  return value === "hide" ? "hide" : "show";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const theme = readThemeCookie(cookieStore.get("theme")?.value);
  const glossary = readGlossaryCookie(cookieStore.get("glossary-visible")?.value);

  return (
    <html
      lang={locale}
      data-theme={theme}
      data-glossary={glossary}
      className={`${newsreaderFont.variable} ${monoFont.variable} ${jpSerifFont.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-jp.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>
          <RegisterSW />
          <OfflineBadge />
          <Masthead />
          {children}
          <BrandDot />
        </LocaleProvider>
      </body>
    </html>
  );
}
