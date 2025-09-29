'use client';

import React, { useState } from 'react';

interface TableData {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  role: string;
  lastLogin: string;
  avatar: string;
}

const DataTable: React.FC = () => {
  const [data] = useState<TableData[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      role: 'Administrator',
      lastLogin: '2 hours ago',
      avatar: 'JD'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      status: 'active',
      role: 'Manager',
      lastLogin: '1 day ago',
      avatar: 'JS'
    },
    {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      status: 'inactive',
      role: 'User',
      lastLogin: '1 week ago',
      avatar: 'BJ'
    },
    {
      id: '4',
      name: 'Alice Brown',
      email: 'alice@example.com',
      status: 'pending',
      role: 'User',
      lastLogin: 'Never',
      avatar: 'AB'
    },
    {
      id: '5',
      name: 'Charlie Wilson',
      email: 'charlie@example.com',
      status: 'active',
      role: 'Editor',
      lastLogin: '3 hours ago',
      avatar: 'CW'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Users</h3>
            <p className="text-sm text-gray-600">Manage your team members and their account permissions</p>
          </div>
          <button className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                      {user.avatar}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">Edit</button>
                    <button className="text-red-600 hover:text-red-900">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">1</span> to <span className="font-medium">5</span> of{' '}
            <span className="font-medium">5</span> results
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md">
              1
            </button>
            <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
