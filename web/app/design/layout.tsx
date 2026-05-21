import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Labra Design',
};

export default function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
