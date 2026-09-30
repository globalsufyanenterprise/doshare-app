import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'DoShare',
  description: 'Send code and PDFs directly between browsers. No uploads, no accounts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} font-[family-name:var(--font-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
