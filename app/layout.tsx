export const metadata = {
  title: "AIA Win LINE Bot",
  description: "LINE webhook service for AIA Win FAQ chatbot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
