import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ErrorHandlerProvider } from "@/components/ErrorHandlerProvider";
import { AuthTransitionProvider } from "@/components/ui/AuthTransition";
import { Toaster } from "sonner";
import GlobalErrorBoundary from "./error-boundary";
import { AuthProvider } from "@/lib/auth/useAuth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TerminalFlow",
  description: "Container management and tracking system",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <GlobalErrorBoundary>
          <ErrorHandlerProvider>
            <AuthTransitionProvider>
              <AuthProvider>
                {children}
                <Toaster position="top-right" richColors />
              </AuthProvider>
            </AuthTransitionProvider>
          </ErrorHandlerProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
