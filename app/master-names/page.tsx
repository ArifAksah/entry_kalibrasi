'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import MasterNamesCRUD from '../ui/dashboard/master-names-crud';

const MasterNamesPage: React.FC = () => {
    return (
        <ProtectedRoute>
            <div className="min-h-screen grid grid-cols-[260px_1fr]">
                <SideNav />
                <div className="bg-gray-50">
                    <Header />
                    <div className="p-6 max-w-7xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900">Master Data</h1>
                            <p className="text-gray-500 mt-1">Kelola data master nama instrumen dan nama sensor</p>
                        </div>
                        <MasterNamesCRUD />
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
};

export default MasterNamesPage;
