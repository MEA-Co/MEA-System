import localFont from 'next/font/local';

import { metadata } from '@/lib/metadata';

import './globals.css';

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  display: 'swap',
  variable: '--font-pretendard',
});

export { metadata };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
