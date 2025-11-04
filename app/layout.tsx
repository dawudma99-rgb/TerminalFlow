import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorHandlerProvider } from "@/components/ErrorHandlerProvider";
import { ListsProvider } from "@/components/providers/ListsProvider";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DnD Copilot",
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
        <ErrorHandlerProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ListsProvider>
              {children}
              <Toaster position="top-right" richColors />
            </ListsProvider>
          </ThemeProvider>
        </ErrorHandlerProvider>
      </body>
    </html>
  );
}
