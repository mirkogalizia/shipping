import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head />
      <body className="bg-indigo-50 font-sans">
        {children}
      </body>
    </html>
  );
}
