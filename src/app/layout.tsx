import type { Metadata } from "next";
import { Source_Code_Pro, Noto_Serif_JP } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const codeFont = Source_Code_Pro({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400"],
});

const readerFont = Noto_Serif_JP({
  variable: "--font-reader",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Shosetu Reader",
  description: "Calm web reader for Syosetu novels with resume and translation flows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${codeFont.variable} ${readerFont.variable} h-full antialiased`}
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
        <Nav />
        {children}
      </body>
    </html>
  );
}
