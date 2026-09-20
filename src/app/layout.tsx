import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediKiosk — AI-Assisted Rural Healthcare Access & Continuity",
  description:
    "MediKiosk (SIH26133, Team Void Reapers): accessible AI-assisted intake, triage, document intelligence, human validation, longitudinal records, referrals, diagnostics and offline-first care continuity for rural India.",
  keywords: ["MediKiosk", "Smart India Hackathon", "SIH26133", "rural healthcare", "ABDM", "healthtech"],
  authors: [{ name: "Team Void Reapers" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230d9488'><path d='M12 21s-7.5-4.7-10-9.3C.5 8 2.4 4.5 6 4.5c2.1 0 3.4 1 4 2 .6-1 1.9-2 4-2 3.6 0 5.5 3.5 4 7.2-2.5 4.6-10 9.3-10 9.3z'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
