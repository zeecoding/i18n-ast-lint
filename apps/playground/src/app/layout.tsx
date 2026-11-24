import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "i18n-ast-lint Playground — AST-Powered i18n Linter & Dead-Key Pruner",
  description:
    "Interactive client-side browser playground for i18n-ast-lint (@locale-lint/core). Test AST key extraction, scoped hooks, <Trans>, dynamic prefixes, and format-preserving JSON pruning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
