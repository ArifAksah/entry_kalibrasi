'use client';

import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import NotesCRUD from '../ui/dashboard/notes-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const NotesPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Notes' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Notes Management</h1>
            <NotesCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default NotesPage;
