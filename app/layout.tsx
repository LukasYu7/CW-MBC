import type { Metadata } from 'next';
import './globals.css';

export const metadata:Metadata={title:'MBCplus Office Map',description:'강남·서초권 주요 오피스 자산 지도'};
export default function RootLayout({children}:{children:React.ReactNode}){
  const basePath=process.env.GITHUB_PAGES_BASE_PATH??'';
  return <html lang="ko"><head><script src={`${basePath}/config.js`}/></head><body>{children}</body></html>
}
