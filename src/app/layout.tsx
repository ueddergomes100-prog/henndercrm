import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Hennder CRM",
  title: "Hennder CRM | Transforme clientes esquecidos em novas vendas",
  description:
    "Hennder CRM: transforme clientes esquecidos em novas vendas com inteligencia comercial e recompra.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Hennder CRM",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#041d40",
    "msapplication-tap-highlight": "no",
  },
  icons: {
    icon: [
      { url: "/icons/hennder-icon-72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/hennder-icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/hennder-icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/hennder-icon-144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/hennder-icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/hennder-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/hennder-icon-384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/hennder-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#041d40",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{const t=localStorage.getItem("henndercrm-theme")||localStorage.getItem("agrocrm-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
