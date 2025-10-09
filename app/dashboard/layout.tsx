import React from 'react';
import SideNav from '../ui/dashboard/sidenav';   // ✅ pakai default import
import NavLinks from '../ui/dashboard/nav-links';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="dashboard-layout flex">
            <SideNav />
            <main className="dashboard-content flex-1">
                <NavLinks />
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;
