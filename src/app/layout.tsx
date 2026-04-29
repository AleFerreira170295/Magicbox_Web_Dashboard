import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MagicBox Web Dashboard",
  description: "Dashboard web lossless para sincronizaciones, partidas y dispositivos MagicBox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full w-full bg-background text-foreground">
        <div id="app-root" className="min-h-full w-full bg-background">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
