import './globals.css';

export const metadata = {
  title: 'Shopify Shipping Dashboard',
  description: 'Calcolo spedizioni personalizzate per Shopify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head />
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}