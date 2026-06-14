import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/shell/BottomNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WHOOP",
  description: "Recovery, strain, sleep and your team in one place.",
  applicationName: "WHOOP",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WHOOP" },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="h-full">
        <Providers>
          <div className="app-backdrop flex h-dvh w-full justify-center overflow-hidden">
            <div className="relative flex h-full w-full max-w-[440px] flex-col bg-ink shadow-[0_0_80px_rgba(0,0,0,0.6)] sm:border-x sm:border-line-soft">
              <main className="no-scrollbar flex-1 overflow-y-auto">{children}</main>
              <BottomNav />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
