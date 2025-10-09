'use client';

import React from 'react';
import Image from 'next/image';
import bmkgLogo from '../../bmkg.png';
import { usePathname } from 'next/navigation';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  HiOutlineHome,
  HiOutlineListBullet,
  HiOutlineCog,
  HiOutlineBuildingOffice,
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineBeaker,
  HiOutlineEnvelope,
  HiOutlineUserGroup,
  HiOutlineKey,
  HiOutlineUserPlus,
  HiOutlineWrenchScrewdriver,
  HiOutlineMapPin
} from 'react-icons/hi2';

type NavItem = { name: string; href: string; icon: React.ReactNode };
type NavSection = { title: string; items: NavItem[] };

const iconClass = "h-5 w-5";

const sections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: <HiOutlineHome className={iconClass} /> },
    ],
  },
  {
    title: 'Sensors',
    items: [
      { name: 'Sensors', href: '/sensors', icon: <HiOutlineCog className={iconClass} /> },
    ],
  },
  {
    title: 'Instruments',
    items: [
      { name: 'Instruments', href: '/instruments', icon: <HiOutlineWrenchScrewdriver className={iconClass} /> },
    ],
  },
  {
    title: 'Stations',
    items: [
      { name: 'Stations', href: '/stations', icon: <HiOutlineBuildingOffice className={iconClass} /> },
    ],
  },
  {
    title: 'Calibration & Verification',
    items: [
      { name: 'Calibration Results', href: '/calibration-results', icon: <HiOutlineDocumentText className={iconClass} /> },
      { name: 'Verifikator Cal Result', href: '/verifikator-cal-result', icon: <HiOutlineCheckCircle className={iconClass} /> },
      { name: 'Verifikator Inspection', href: '/verifikator-inspection-results', icon: <HiOutlineCheckCircle className={iconClass} /> },
      { name: 'Certificate Verification', href: '/certificate-verification', icon: <HiOutlineCheckCircle className={iconClass} /> },
      { name: 'Personel', href: '/inspection-person', icon: <HiOutlineUserGroup className={iconClass} /> },
    ],
  },
  {
    title: 'Documents',
    items: [
      { name: 'Certificates', href: '/certificates', icon: <HiOutlineDocumentText className={iconClass} /> },
      { name: 'Letters', href: '/letters', icon: <HiOutlineEnvelope className={iconClass} /> },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Role Permissions', href: '/role-permissions', icon: <HiOutlineKey className={iconClass} /> },
      { name: 'Endpoint Permissions', href: '/endpoint-permissions', icon: <HiOutlineListBullet className={iconClass} /> },
      { name: 'Registrasi Personel', href: '/register', icon: <HiOutlineUserPlus className={iconClass} /> },
      { name: 'Manajemen Personel', href: '/personel', icon: <HiOutlineUserGroup className={iconClass} /> },
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
                if (href === '/sensors') return canEndpoint('GET', '/api/sensors')
              }
              
              // Instruments section
              if (section.title === 'Instruments') {
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
                if (href === '/verifikator-inspection-results') return canEndpoint('GET', '/api/verifikator-inspection-results')
                if (href === '/certificate-verification') return canEndpoint('GET', '/api/certificate-verification/pending')
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
                    if (href === '/sensors') return canEndpoint('GET', '/api/sensors')
                  }
                  
                  // Instruments section
                  if (section.title === 'Instruments') {
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
                    if (href === '/verifikator-inspection-results') return canEndpoint('GET', '/api/verifikator-inspection-results')
                    if (href === '/certificate-verification') return canEndpoint('GET', '/api/certificate-verification/pending')
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