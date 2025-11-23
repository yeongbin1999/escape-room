import "@/styles/globals.css";

export const metadata = {
  title: "방탈출",
  description: "방탈출 웹앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen flex items-center justify-center bg-background">
        {children}
      </body>
    </html>
  );
}