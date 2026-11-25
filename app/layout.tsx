import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./appearance.css";
import "./returning-welcome.css";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "ClerkMe | AI Clinical Exam Prep & Clerking",
  description: "Clinical learning and exam preparation for medical students. Turn lectures into detailed study guides and SBA questions, read your source documents in-app, discover YouTube lectures, and practise clerking, OSCE, Viva and clinical simulation.",
  applicationName: "ClerkMe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/clerkme-mark-navy.svg", type: "image/svg+xml" }],
  },
  keywords: ["clinical clerking", "medical students", "AI exam preparation", "SBA questions", "YouTube medical lectures", "OSCE", "Viva", "clinical simulation", "Africa"],
};

export const viewport: Viewport = {
  themeColor: "#102D5A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('clerkme-theme')||'light';var d=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d;}catch(e){}})();" }}/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
