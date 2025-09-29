'use client';

import React from 'react';
import Image from 'next/image';
import bmkgLogo from '../../bmkg.png';
import { usePathname } from 'next/navigation';
import { usePermissions } from '../../../hooks/usePermissions';

type NavItem = { name: string; href: string; icon: React.ReactNode };
type NavSection = { title: string; items: NavItem[] };

// Minimal inline Heroicons (outline)
const Icon = {
  dashboard: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 12a8.25 8.25 0 1116.5 0 8.25 8.25 0 01-16.5 0z"/>
      <path d="M12 7.5v4.5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  sensor: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v18M3 12h18" strokeLinecap="round"/>
    </svg>
  ),
  list: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
    </svg>
  ),
  tool: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.5 6.75l6.75 6.75M6.75 10.5l6.75 6.75M4.5 19.5l6-1.5-4.5-4.5-1.5 6z"/>
    </svg>
  ),
  building: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 21h16.5M6 21V6.75A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75V21"/>
      <path d="M9 9h6M9 12h6M9 15h6"/>
    </svg>
  ),
  doc: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.25 3.75h6L18 7.5v12A.75.75 0 0117.25 21h-10.5A.75.75 0 016 20.25v-15A.75.75 0 016.75 4.5h1.5z"/>
      <path d="M9 12h6M9 15h6M9 9h3"/>
    </svg>
  ),
  check: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 12.75l4.5 4.5 10.5-10.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  beaker: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 3v6L4 18a3 3 0 003 3h10a3 3 0 003-3l-5-9V3"/>
    </svg>
  ),
  mail: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.75 7.5l8.25 6 8.25-6M4.5 6h15a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119.5 18h-15A1.5 1.5 0 013 16.5v-9A1.5 1.5 0 014.5 6z"/>
    </svg>
  ),
};

const sections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: Icon.dashboard },
    ],
  },
  {
    title: 'Sensors',
    items: [
      { name: 'Sensor Names', href: '/sensor-names', icon: Icon.list },
      { name: 'Sensors', href: '/sensors', icon: Icon.sensor },
      { name: 'Notes', href: '/notes', icon: Icon.doc },
    ],
  },
  {
    title: 'Instruments',
    items: [
      { name: 'Instrument Names', href: '/instrument-names', icon: Icon.list },
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
    title: 'Calibration & Verification',
    items: [
      { name: 'Calibration Results', href: '/calibration-results', icon: Icon.doc },
      { name: 'Verifikator Cal Result', href: '/verifikator-cal-result', icon: Icon.check },
      { name: 'Notes Instrumen Standard', href: '/notes-instrumen-standard', icon: Icon.beaker },
      { name: 'Verifikator Inspection', href: '/verifikator-inspection-results', icon: Icon.check },
      { name: 'Personel', href: '/inspection-person', icon: Icon.doc },
    ],
  },
  {
    title: 'Documents',
    items: [
      { name: 'Certificates', href: '/certificates', icon: Icon.doc },
      { name: 'Letters', href: '/letters', icon: Icon.mail },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Role Permissions', href: '/role-permissions', icon: Icon.check },
      { name: 'Endpoint Permissions', href: '/endpoint-permissions', icon: Icon.list },
      { name: 'Registrasi Personel', href: '/register', icon: Icon.mail },
      { name: 'Manajemen Personel', href: '/personel', icon: Icon.doc },
    ],
  },
];

const SideNav: React.FC = () => {
  const pathname = usePathname();
  const { can, canEndpoint, loading } = usePermissions();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside className="h-screen sticky top-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Image src={bmkgLogo} alt="BMKG" width={32} height={32} className="h-8 w-8" />
          <div>
            <h1 className="text-slate-900 font-bold text-xl">SIKAP-SV</h1>
            <p className="text-gray-500 text-sm">BMKG Calibration System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          sections
            .filter((section) => {
              // Hide entire section if no endpoints are accessible
            
            return section.items.some(item => {
              const href = item.href
              
              // Overview section
              if (section.title === 'Overview') {
                if (href === '/') return true // Dashboard always accessible
              }
              
              // Sensors section
              if (section.title === 'Sensors') {
                if (href === '/sensor-names') return canEndpoint('GET', '/api/sensor-names')
                if (href === '/sensors') return canEndpoint('GET', '/api/sensors')
                if (href === '/notes') return canEndpoint('GET', '/api/notes')
              }
              
              // Instruments section
              if (section.title === 'Instruments') {
                if (href === '/instrument-names') return canEndpoint('GET', '/api/instrument-names')
                if (href === '/instruments') return canEndpoint('GET', '/api/instruments')
              }
              
              // Stations section
              if (section.title === 'Stations') {
                if (href === '/stations') return canEndpoint('GET', '/api/stations')
              }
              
              // Calibration & Verification section
              if (section.title === 'Calibration & Verification') {
                if (href === '/calibration-results') return canEndpoint('GET', '/api/calibration-results')
                if (href === '/verifikator-cal-result') return canEndpoint('GET', '/api/verifikator-cal-result')
                if (href === '/notes-instrumen-standard') return canEndpoint('GET', '/api/notes-instrumen-standard')
                if (href === '/verifikator-inspection-results') return canEndpoint('GET', '/api/verifikator-inspection-results')
                if (href === '/inspection-person') return canEndpoint('GET', '/api/inspection-person')
              }
              
              // Documents section
              if (section.title === 'Documents') {
                if (href === '/certificates') return canEndpoint('GET', '/api/certificates')
                if (href === '/letters') return canEndpoint('GET', '/api/letters')
              }
              
              // Administration section
              if (section.title === 'Administration') {
                if (href === '/role-permissions') return canEndpoint('GET', '/api/role-permissions')
                if (href === '/endpoint-permissions') return canEndpoint('GET', '/api/endpoint-catalog')
                if (href === '/register') return canEndpoint('POST', '/api/personel')
                if (href === '/personel') return canEndpoint('GET', '/api/personel')
              }
              
              return false
            })
          })
          .map((section) => (
          <div key={section.title}>
            <p className="px-4 mb-2 text-xs font-semibold text-gray-400 tracking-wider uppercase">{section.title}</p>
            <ul className="space-y-1 list-none">
              {section.items
                .filter((item) => {
                  // Check endpoint permissions for all menus
                  if (loading) return true
                  const href = item.href
                  
                  // Overview section
                  if (section.title === 'Overview') {
                    if (href === '/') return true // Dashboard always accessible
                  }
                  
                  // Sensors section
                  if (section.title === 'Sensors') {
                    if (href === '/sensor-names') return canEndpoint('GET', '/api/sensor-names')
                    if (href === '/sensors') return canEndpoint('GET', '/api/sensors')
                    if (href === '/notes') return canEndpoint('GET', '/api/notes')
                  }
                  
                  // Instruments section
                  if (section.title === 'Instruments') {
                    if (href === '/instrument-names') return canEndpoint('GET', '/api/instrument-names')
                    if (href === '/instruments') return canEndpoint('GET', '/api/instruments')
                  }
                  
                  // Stations section
                  if (section.title === 'Stations') {
                    if (href === '/stations') return canEndpoint('GET', '/api/stations')
                  }
                  
                  // Calibration & Verification section
                  if (section.title === 'Calibration & Verification') {
                    if (href === '/calibration-results') return canEndpoint('GET', '/api/calibration-results')
                    if (href === '/verifikator-cal-result') return canEndpoint('GET', '/api/verifikator-cal-result')
                    if (href === '/notes-instrumen-standard') return canEndpoint('GET', '/api/notes-instrumen-standard')
                    if (href === '/verifikator-inspection-results') return canEndpoint('GET', '/api/verifikator-inspection-results')
                    if (href === '/inspection-person') return canEndpoint('GET', '/api/inspection-person')
                  }
                  
                  // Documents section
                  if (section.title === 'Documents') {
                    if (href === '/certificates') return canEndpoint('GET', '/api/certificates')
                    if (href === '/letters') return canEndpoint('GET', '/api/letters')
                  }
                  
                  // Administration section
                  if (section.title === 'Administration') {
                    if (href === '/role-permissions') return canEndpoint('GET', '/api/role-permissions')
                    if (href === '/endpoint-permissions') return canEndpoint('GET', '/api/endpoint-catalog')
                    if (href === '/register') return canEndpoint('POST', '/api/personel')
                    if (href === '/personel') return canEndpoint('GET', '/api/personel')
                  }
                  
                  return false
                })
                .map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive(item.href) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))
        )}
      </nav>

      {/* Footer / Profile (optional) */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">v1.0</p>
      </div>
    </aside>
  );
};

export default SideNav;