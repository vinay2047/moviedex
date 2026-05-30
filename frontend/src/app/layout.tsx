import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MovieDex — Personalized Movie Recommendations",
  description:
    "Discover your next favorite movie with intelligent, personalized recommendations. MovieDex learns your unique taste to surface films you'll genuinely love.",
  keywords: ["movies", "recommendations", "personalized", "discover", "cinema"],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-surface-950 text-surface-200 font-sans antialiased">
        {/* Ambient background — subtle, muted orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="orb w-[500px] h-[500px] bg-primary-600 top-[-15%] left-[15%]" />
          <div
            className="orb w-[400px] h-[400px] bg-primary-800 bottom-[5%] right-[5%]"
            style={{ animationDelay: "3s" }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
