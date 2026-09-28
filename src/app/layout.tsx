import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { LocationProvider } from "@/context/LocationContext";
import Navbar from "@/components/Navbar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "SkyWatch: Weather Monitoring Dashboard",
  description:
    "A full weather monitoring dashboard: forecasts, air quality, AI insights, maps, alerts, and reports.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SkyWatch",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <ThemeProvider>
          <LocationProvider>
            <Navbar />
            <main className="page-shell">{children}</main>
            <ServiceWorkerRegister />
          </LocationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
