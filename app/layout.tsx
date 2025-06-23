// File: app/layout.tsx
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Shopify Shipping Dashboard',
  description: 'Calcolo spedizioni personalizzate per Shopify',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head />
      <body className="bg-indigo-50 font-sans">
        {children}
      </body>
    </html>
  );
}