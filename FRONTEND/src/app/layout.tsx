import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Quinty DAO - Decentralized Bounty System',
  description: 'A transparent bounty platform with DAO governance, reputation NFTs, and dispute resolution on Somnia Testnet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}