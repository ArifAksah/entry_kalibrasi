'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import bmkgLogo from '../../logo-bmkg-w.png';
import { usePathname } from 'next/navigation';
import { usePermissions } from '../../../hooks/usePermissions';

type NavItem = { name: string; href: string; icon: React.ReactNode };
type NavSection = { title: string; items: NavItem[] };

// Icons dengan warna yang match theme
const Icon = {
  dashboard: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 12a8.25 8.25 0 1116.5 0 8.25 8.25 0 01-16.5 0z" />
      <path d="M12 7.5v4.5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  list: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  ),
  tool: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.5 6.75l6.75 6.75M6.75 10.5l6.75 6.75M4.5 19.5l6-1.5-4.5-4.5-1.5 6z" />
    </svg>
  ),
  building: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 21h16.5M6 21V6.75A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75V21" />
      <path d="M9 9h6M9 12h6M9 15h6" />
    </svg>
  ),
  doc: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.25 3.75h6L18 7.5v12A.75.75 0 0117.25 21h-10.5A.75.75 0 016 20.25v-15A.75.75 0 016.75 4.5h1.5z" />
      <path d="M9 12h6M9 15h6M9 9h3" />
    </svg>
  ),
  check: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 12.75l4.5 4.5 10.5-10.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  beaker: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 3v6L4 18a3 3 0 003 3h10a3 3 0 003-3l-5-9V3" />
    </svg>
  ),
  mail: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 7.5l8.25 6 8.25-6M4.5 6h15a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119.5 18h-15A1.5 1.5 0 013 16.5v-9A1.5 1.5 0 014.5 6z" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  database: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3v2c0 1.657-3.582 3-8 3S4 10.657 4 9V7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9v5c0 1.657 3.582 3 8 3s8-1.343 8-3V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// Sections configuration
const sections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: Icon.dashboard },
    ],
  },
  {
    title: 'Instruments',
    items: [
      { name: 'Instruments', href: '/instruments', icon: Icon.tool },
    ],
  },
  {
    title: 'Stations',
    items: [
      { name: 'Stations', href: '/stations', icon: Icon.building },
    ],
  },
  {
    title: 'Documents',
    items: [
      { name: 'Certificates', href: '/certificates', icon: Icon.doc },
      { name: 'Certificate Logs', href: '/certificate-logs', icon: Icon.clock },
      { name: 'Letters', href: '/letters', icon: Icon.mail },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Role Permissions', href: '/role-permissions', icon: Icon.check },
      { name: 'Endpoint Permissions', href: '/endpoint-permissions', icon: Icon.list },
      { name: 'Manajemen Personel', href: '/personel', icon: Icon.doc },
      { name: 'Assign Stations', href: '/user-stations', icon: Icon.building },
      { name: 'Master Satuan', href: '/units', icon: Icon.beaker },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { name: 'Master Nama', href: '/master-names', icon: Icon.database },
    ],
  },
];

const SideNav: React.FC = () => {
  const pathname = usePathname();
  const { canEndpoint, loading, role } = usePermissions();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const filteredSections = useMemo(() => {
    if (loading) return [];

    console.log('Current role:', role);

    // Filter sections based on user role
    const roleBasedSections = sections.map(section => {
      if (section.title === 'Overview') {
        return section; // Dashboard always available
      }

      if (section.title === 'Administration') {
        // Only admin can see administration section
        if (role === 'admin') {
          return section;
        }
        return { ...section, items: [] };
      }

      if (section.title === 'Master Data') {
        // Admin and calibrator can see Master Data
        if (role === 'admin' || role === 'calibrator') {
          return section;
        }
        return { ...section, items: [] };
      }

      if (section.title === 'Documents') {
        // Show Certificates to all roles (list is personalized on the page)
        const filteredItems = section.items.filter(item => {
          if (item.name === 'Letters') {
            // Only admin and assignor can see letters
            return role === 'admin' || role === 'assignor';
          }
          if (item.name === 'Certificate Logs') {
            // Certificate Logs visible to admin and assignor only
            return role === 'admin' || role === 'assignor';
          }
          if (item.name === 'Certificates') {
            // Hide Certificates for verifikator and assignor
            return role !== 'verifikator' && role !== 'assignor';
          }
          return true; // Draft View already removed above
        });



        // Keep Certificate Verification for verifikator and assignor roles
        if (role === 'verifikator' || role === 'assignor') {
          filteredItems.push({
            name: 'Certificate Verification',
            href: '/certificate-verification',
            icon: Icon.check
          });
        }

        return { ...section, items: filteredItems };
      }

      // For other sections, check permissions
      const filteredItems = section.items.filter(item => {
        // Instruments, Stations - hidden for verifikator and assignor
        if (['Instruments', 'Stations'].includes(item.name)) {
          if (role === 'verifikator' || role === 'assignor') {
            return false;
          }
          return true;
        }

        return true;
      });

      return { ...section, items: filteredItems };
    }).filter(section => section.items.length > 0);

    return roleBasedSections;
  }, [loading, role]);

  if (loading) {
    return (
      <aside className="h-screen sticky top-0 bg-gradient-to-b from-slate-800 to-blue-900 border-r border-slate-700 flex flex-col w-64">
        <div className="px-4 py-2 border-b border-slate-700">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 mb-2 bg-slate-700 rounded-full animate-pulse"></div>
            <div className="h-5 w-32 bg-slate-700 rounded animate-pulse mb-0.5"></div>
            <div className="h-3 w-40 bg-slate-700 rounded animate-pulse"></div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-slate-700 rounded animate-pulse mb-2 ml-3"></div>
              <ul className="space-y-1">
                {[...Array(3)].map((_, j) => (
                  <li key={j} className="h-8 bg-slate-700/50 rounded animate-pulse"></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside id="sidenav-container" className="h-screen sticky top-0 bg-gradient-to-b from-slate-800 to-blue-900 border-r border-slate-700 flex flex-col w-64 shadow-2xl">
      {/* Logo Section - Flat Design */}
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="flex flex-col items-center text-center">
          {/* Logo tanpa background card */}
          <div className="mb-4 p-2">
            <Image
              src={bmkgLogo}
              alt="BMKG"
              width={50}
              height={50}
              className="drop-shadow-lg"
              style={{ filter: 'none' }}
              priority
            />
          </div>

          <p className="text-blue-200 text-xs font-medium">BMKG Calibration System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-6">
        {filteredSections.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <p>No menus available</p>
            <p className="text-sm">Check your permissions</p>
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-3 text-xs font-bold text-cyan-400 tracking-wider uppercase">
                {section.title}
              </p>
              <ul className="space-y-2 list-none">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className={`group flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-300 border-l-4 ${isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-600/30 to-cyan-600/30 text-white border-cyan-400 shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white border-transparent hover:border-cyan-400/50 hover:shadow-md'
                        }`}
                    >
                      <span className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive(item.href) ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'
                        }`}>
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold transition-all duration-300">
                        {item.name}
                      </span>
                      {isActive(item.href) && (
                        <div className="ml-auto w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 text-center font-medium">v1.0 • BMKG Calibration</p>
      </div>
    </aside>
  );
};

export default SideNav;