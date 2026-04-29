import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0000FF",
};

export const metadata: Metadata = {
  title: "SOS Moto Resgate",
  description: "Solicite guincho para sua moto de forma rápida e simples.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SOS Moto",
    startupImage: "/icons/icon-512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-background text-foreground flex flex-col transition-colors duration-300`}
      >
        <ThemeProvider>
          <PWARegister />
          <header className="bg-primary/95 dark:bg-gray-900/95 backdrop-blur-md text-primary-foreground py-4 px-6 sticky top-0 z-50 shadow-sm border-b border-primary/10 dark:border-gray-800 transition-colors duration-300">
            <div className="container mx-auto max-w-6xl flex items-center justify-between">
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 bg-white dark:bg-gray-800 text-primary dark:text-blue-400 rounded-lg flex items-center justify-center text-sm transition-colors duration-300">SOS</span>
                Moto Resgate
              </h1>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <a href="/login" className="text-sm font-semibold hover:opacity-100 opacity-80 transition-opacity bg-primary-foreground/10 px-4 py-2 rounded-full hidden sm:block">
                  Painel de Administração
                </a>
              </div>
            </div>
          </header>
          <main className="container mx-auto p-4 md:p-6 max-w-6xl flex-1 flex flex-col mb-12">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
