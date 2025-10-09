'use client';

import React from 'react';
import SideNav from '../ui/dashboard/sidenav';
import Header from '../ui/dashboard/header';
import StatsCards from '../ui/dashboard/stats-cards';
import Chart from '../ui/dashboard/chart';
import DataTable from '../ui/dashboard/data-table';
import SensorNamesCRUD from '../ui/dashboard/sensor-names-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-container">
      <SideNav />
      <div className="main-content">
        <Header />
        <div className="p-6">
          <Breadcrumb items={[{ label: 'Dashboard' }]} />
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview 📊</h1>
            <p className="text-gray-600">Monitor your business performance and key metrics.</p>
          </div>

          {/* Stats Cards */}
          <StatsCards />

          {/* Charts and Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Chart />
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">New order received</p>
                    <p className="text-xs text-gray-500">Order #1234 - $299.00</p>
                  </div>
                  <span className="text-xs text-gray-400">2m ago</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">User registered</p>
                    <p className="text-xs text-gray-500">New user: john@example.com</p>
                  </div>
                  <span className="text-xs text-gray-400">5m ago</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Low stock alert</p>
                    <p className="text-xs text-gray-500">Product "Widget A" - 5 items left</p>
                  </div>
                  <span className="text-xs text-gray-400">1h ago</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <DataTable />

          {/* Sensor Names CRUD */}
          <div className="mt-8">
            <SensorNamesCRUD />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;