"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/",          label: "Overview",   icon: "🏠" },
  { href: "/customers", label: "Customers",  icon: "👥" },
  { href: "/orders",    label: "Orders",     icon: "📦" },
  { href: "/segments",  label: "Segments",   icon: "🎯" },
  { href: "/campaigns", label: "Campaigns",  icon: "📣" },
  { href: "/insights",  label: "Insights",   icon: "📊" },
  { href: "/import",    label: "CSV Import", icon: "⬆️" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="topnav">
        {/* ── Brand ── */}
        <Link href="/" className="topnav-brand">
          <div className="topnav-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="topnav-brand-text">
            <span className="topnav-brand-name">SmartCRM</span>
            <span className="topnav-brand-sub">by Xeno</span>
          </div>
        </Link>

        {/* ── Desktop Nav Links ── */}
        <nav className="topnav-links" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`topnav-link${isActive(link.href) ? " topnav-link--active" : ""}`}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              <span className="topnav-link-icon" aria-hidden="true">{link.icon}</span>
              <span className="topnav-link-label">{link.label}</span>
              {isActive(link.href) && <span className="topnav-link-indicator" />}
            </Link>
          ))}
        </nav>

        {/* ── Right side actions ── */}
        <div className="topnav-actions">
          <Link href="/campaigns/new" className="topnav-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Campaign
          </Link>

          {/* Mobile hamburger */}
          <button
            className="topnav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span className={`hamburger-bar${menuOpen ? " open" : ""}`}/>
            <span className={`hamburger-bar${menuOpen ? " open" : ""}`}/>
            <span className={`hamburger-bar${menuOpen ? " open" : ""}`}/>
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      {menuOpen && (
        <div className="mobile-drawer" role="dialog" aria-label="Mobile navigation">
          <div className="mobile-drawer-overlay" onClick={() => setMenuOpen(false)} />
          <nav className="mobile-drawer-nav">
            <div className="mobile-drawer-header">
              <span className="topnav-brand-name" style={{ fontSize: "18px" }}>SmartCRM</span>
              <button className="mobile-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`mobile-nav-link${isActive(link.href) ? " mobile-nav-link--active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="topnav-link-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <div className="mobile-drawer-footer">
              <Link
                href="/campaigns/new"
                className="topnav-cta"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setMenuOpen(false)}
              >
                + New Campaign
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
