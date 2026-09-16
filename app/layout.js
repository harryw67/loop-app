import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = { title: 'Loop', description: 'Rent clothes from people near you' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 1080, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Nav />
          <main className="app-main" style={{ padding: '32px 28px 64px', flex: 1 }}>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
