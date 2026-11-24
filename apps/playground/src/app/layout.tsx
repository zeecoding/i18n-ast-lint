import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "i18n-ast-lint Workbench — TypeScript AST i18n Linter & Dead-Key Pruner",
  description:
    "Client-side static analysis workbench for i18n-ast-lint (@locale-lint/core). Inspect lexical hook scopes, JSX <Trans> extraction, dynamic template protection, and format-preserving JSON pruning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${jetBrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-[#0B0E14] font-sans text-[#F4F6F8] antialiased">
        <a
          href="#workbench-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[6px] focus:bg-[#10B981] focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#0B0E14]"
        >
          Skip to AST Workbench
        </a>
        {children}
      </body>
    </html>
  );
}
