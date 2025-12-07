import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
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
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <AuthTransitionProvider>
                <AuthProvider>
                  {children}
                  <Toaster position="top-right" richColors />
                </AuthProvider>
              </AuthTransitionProvider>
            </ThemeProvider>
          </ErrorHandlerProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
