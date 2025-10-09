import React from 'react';
import { Sidenav } from '../ui/dashboard/sidenav';
import { NavLinks } from '../ui/dashboard/nav-links';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="dashboard-layout">
            <Sidenav />
            <main className="dashboard-content">
                <NavLinks />
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;