export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  );
}