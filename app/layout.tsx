import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClerkMe | AI Clinical Exam Prep & Clerking",
  description: "AI-powered clinical learning and exam preparation for medical students. Build detailed High-Yield study guides, generate SBAs, discover and watch YouTube lectures in-app, and practise clerking, OSCE, Viva and clinical simulation.",
  applicationName: "ClerkMe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/clerkme-icon.svg",
    apple: "/clerkme-icon.svg",
  },
  keywords: ["clinical clerking", "medical students", "AI exam preparation", "High-Yield Points", "SBA questions", "YouTube medical lectures", "OSCE", "Viva", "clinical simulation", "Africa"],
};

export const viewport: Viewport = {
  themeColor: "#0b4a34",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
