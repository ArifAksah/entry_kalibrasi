import React from 'react';
import Link from 'next/link';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/reports', label: 'Reports' },
];

const NavLinks: React.FC = () => {
  return (
    <nav>
      <ul>
        {navLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default NavLinks;