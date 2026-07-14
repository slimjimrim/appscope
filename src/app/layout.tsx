import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppScope",
  description: "Local App Store research & ASO intelligence",
};

const NAV = [
  { href: "/", label: "Search", icon: "🔍" },
  { href: "/tracked", label: "Tracked apps", icon: "📌" },
  { href: "/keywords", label: "Keywords", icon: "🏷️" },
  { href: "/research", label: "Research", icon: "🧪" },
  { href: "/reviews", label: "Reviews", icon: "💬" },
  { href: "/charts", label: "Top charts", icon: "📈" },
  { href: "/compare", label: "Compare", icon: "⚖️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="w-52 shrink-0 border-r border-line px-3 py-5 flex flex-col gap-1 sticky top-0 h-screen">
            <Link href="/" className="px-2 pb-4 text-[15px] font-semibold tracking-tight">
              <span className="text-accent">●</span> AppScope
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-2.5 py-1.5 text-[13.5px] text-ink-2 hover:bg-surface hover:text-ink transition-colors"
              >
                <span className="mr-2 text-[12px]">{n.icon}</span>
                {n.label}
              </Link>
            ))}
            <div className="mt-auto px-2 text-[11px] text-muted">
              Local · free Apple endpoints
            </div>
          </aside>
          <main className="flex-1 min-w-0 px-8 py-6 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
