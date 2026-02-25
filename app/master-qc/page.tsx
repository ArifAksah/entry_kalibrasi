'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import MasterQCCRUD from '../ui/dashboard/master-qc-crud';

const MasterQCPage: React.FC = () => {
    return (
        <ProtectedRoute>
            <div className="min-h-screen grid grid-cols-[260px_1fr]">
                <SideNav />
                <div className="bg-gray-50">
                    <Header />
                    <div className="p-6 max-w-7xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900">Master QC</h1>
                            <p className="text-gray-500 mt-1">Kelola data nilai batas koreksi untuk setiap jenis sensor</p>
                        </div>
                        <MasterQCCRUD />
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
};

export default MasterQCPage;
