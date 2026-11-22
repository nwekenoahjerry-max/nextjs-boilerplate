import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClerkMe | AI Clinical Exam Prep & Clerking",
  description: "AI-powered clinical exam preparation and clerking for medical students. Build study guides, practise SBAs, OSCEs and Viva, and strengthen clinical reasoning.",
  applicationName: "ClerkMe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/clerkme-icon.svg",
    apple: "/clerkme-icon.svg",
  },
  keywords: ["clinical clerking", "medical students", "OSCE", "clinical skills", "Africa"],
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
      <body>{children}</body>
    </html>
  );
}
