'use client';
import './globals.css';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconHome, IconUserPlus, IconSettings, IconGithub,
} from '@/components/icons';

function ApiKeyBanner() {
  const [hasKey, setHasKey] = useState(true);
  useEffect(() => {
    setHasKey(!!localStorage.getItem('gemini_api_key'));
  }, []);
  if (hasKey) return null;
  return (
    <div className="banner">
      <span><strong>No API key configured.</strong> Add your Gemini key to start generating.</span>
      <Link href="/settings" className="btn btn-primary">Open settings</Link>
    </div>
  );
}

const NAV = [
  { href: '/', label: 'Dashboard', icon: IconHome },
  { href: '/personas/new', label: 'New persona', icon: IconUserPlus },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export default function RootLayout({ children }) {
  const pathname = usePathname();
  return (
    <html lang="en">
      <head>
          <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <title>Money Printer Pro — AI image generator</title>
        <meta name="description" content="Source-available AI image generator with persona identity preservation. Bring your own Gemini API key." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark">M</span>
              <span>Money Printer</span>
            </div>

            <div className="nav-section">Workspace</div>
            <nav className="nav">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link${active ? ' active' : ''}`}
                  >
                    <Icon /> {label}
                  </Link>
                );
              })}
            </nav>

            <div className="sidebar-foot">
              <a
                href="https://github.com/office233/MoneyPrinterPro"
                target="_blank"
                rel="noopener noreferrer"
                className="row"
                style={{ gap: 6 }}
              >
                <IconGithub size={13} /> Star on GitHub
              </a>
              <span>v2.0 · BSL 1.1</span>
            </div>
          </aside>

          <main className="main">
            <div className="main-inner">
              <ApiKeyBanner />
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
