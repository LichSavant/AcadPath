import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AcadPath · Academic planning',
  description:
    'Your prerequisite-aware academic roadmap, semester planner, and what-if simulator.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
