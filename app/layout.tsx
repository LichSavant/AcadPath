import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AcadPath · USC Academic Planning',
  description:
    'A prerequisite-aware academic roadmap for University of San Carlos students, semester planner, and what-if simulator.',
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
