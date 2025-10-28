'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Person = { 
  id: string
  name: string
  email: string
  phone?: string | null
  position?: string | null
  nip?: string | null 
}

type UserStation = {
  id: number
  user_id: string
  station_id: number
  created_at: string
}

type Station = {
  id: number
  name: string
  station_id: string | number
  address?: string | null
}

const UserStationAssignment: React.FC = () => {
  const [users, setUsers] = useState<Person[]>([])
  const [userStations, setUserStations] = useState<UserStation[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stationSearchQuery, setStationSearchQuery] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  
  // Client-side pagination for station display (all stations are loaded)
  const [currentPage, setCurrentPage] = useState(1)
  const stationsPerPage = 10
  
  // Mapping of user_id -> array of station_ids
  const [selectedStations, setSelectedStations] = useState<Record<string, number[]>>({})

  useEffect(() => {
    fetchUsers()
    fetchUserStations()
    fetchAllStations()
  }, [])

  const fetchAllStations = async () => {
    try {
      console.log('Fetching all stations for assignment...')
      // Use the existing stations API with a large page size to get all stations
      const response = await fetch('/api/stations?pageSize=1000&page=1')
      if (!response.ok) throw new Error('Failed to fetch stations')
      const data = await response.json()
      console.log(`Received ${data?.data?.length || 0} stations from API (total: ${data?.total || 0})`)
      setStations(data?.data || [])
    } catch (error) {
      console.error('Error fetching stations:', error)
      setError('Failed to fetch stations')
    }
  }

  const fetchUsers = async () => {
    try {
      const { data: personel, error } = await supabase
        .from('personel')
        .select('*')
        .order('name')
      
      if (error) throw error
      
      setUsers(personel || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserStations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_stations')
        .select('*')
      
      if (error) throw error
      
      setUserStations(data || [])
      
      // Initialize selectedStations from existing assignments
      const stationMap: Record<string, number[]> = {}
      data?.forEach(us => {
        if (!stationMap[us.user_id]) {
          stationMap[us.user_id] = []
        }
        stationMap[us.user_id].push(us.station_id)
      })
      setSelectedStations(stationMap)
      
    } catch (error) {
      console.error('Error fetching user stations:', error)
      setError('Failed to fetch user stations')
    }
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId)
    setError(null)
    setSuccess(null)
    setCurrentPage(1) // Reset to first page when selecting a new user
    
    // Initialize if not exists
    if (!selectedStations[userId]) {
      setSelectedStations(prev => ({
        ...prev,
        [userId]: []
      }))
    }
  }

  const handleStationToggle = (stationId: number) => {
    if (!selectedUser) return
    
    setSelectedStations(prev => {
      const userStations = [...(prev[selectedUser] || [])]
      const index = userStations.indexOf(stationId)
      
      if (index > -1) {
        userStations.splice(index, 1) // Remove station
      } else {
        userStations.push(stationId) // Add station
      }
      
      return {
        ...prev,
        [selectedUser]: userStations
      }
    })
  }

  const saveUserStations = async () => {
    if (!selectedUser) return
    
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Delete existing assignments for this user
      const { error: deleteError } = await supabase
        .from('user_stations')
        .delete()
        .eq('user_id', selectedUser)
      
      if (deleteError) throw deleteError
      
      // Insert new assignments
      const userStationIds = selectedStations[selectedUser] || [];
      const newAssignments = userStationIds.map(stationId => ({
        user_id: selectedUser,
        station_id: stationId
      }))
      
      if (newAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from('user_stations')
          .insert(newAssignments)
        
        if (insertError) throw insertError
      }
      
      setSuccess('Station assignments saved successfully')
      await fetchUserStations() // Refresh the list
      
    } catch (error) {
      console.error('Error saving user stations:', error)
      setError('Failed to save station assignments')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.nip || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredStations = stations.filter(station => {
    const query = stationSearchQuery.toLowerCase();
    const stationName = station.name ? station.name.toLowerCase() : '';
    const stationId = station.station_id ? String(station.station_id).toLowerCase() : '';
    const stationAddress = station.address ? station.address.toLowerCase() : '';
    
    const matches = stationName.includes(query) || 
           stationId.includes(query) || 
           stationAddress.includes(query);
    
    // Debug logging for search
    if (stationSearchQuery && matches) {
      console.log(`Station "${station.name}" matches search "${stationSearchQuery}"`)
    }
    
    return matches;
  });

  // Get current stations for pagination
  const indexOfLastStation = currentPage * stationsPerPage;
  const indexOfFirstStation = indexOfLastStation - stationsPerPage;
  const currentStations = filteredStations.slice(indexOfFirstStation, indexOfLastStation);
  const totalPages = Math.ceil(filteredStations.length / stationsPerPage);

  // Debug logging
  console.log(`Total stations loaded: ${stations.length}`);
  console.log(`Filtered stations: ${filteredStations.length}`);
  console.log(`Current page: ${currentPage}, Total pages: ${totalPages}`);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Selection Panel */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Select User</h3>
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No users found</p>
              ) : (
                <ul className="space-y-1">
                  {filteredUsers.map(user => (
                    <li key={user.id}>
                      <button
                        onClick={() => handleUserSelect(user.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedUser === user.id
                            ? 'bg-blue-100 text-blue-800'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.nip && (
                          <div className="text-xs text-gray-400">NIP: {user.nip}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Station Selection Panel */}
          <div className="md:col-span-2 border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex justify-between items-center mb-4 p-4 pb-0">
              <h3 className="text-lg font-medium text-gray-900">Assign Stations</h3>
              
              <button
                onClick={saveUserStations}
                disabled={!selectedUser || saving}
                className={`px-4 py-2 rounded-lg text-white font-medium text-sm ${
                  !selectedUser || saving
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                }`}
              >
                {saving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : 'Save Assignments'}
              </button>
            </div>
            
            {!selectedUser ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <p>Select a user to assign stations</p>
              </div>
            ) : (
              <div className="p-4 pt-0">
                <p className="mb-4 text-sm text-gray-600">
                  Select the stations that should be assigned to{' '}
                  <span className="font-medium text-blue-600">
                    {users.find(u => u.id === selectedUser)?.name}
                  </span>
                </p>

                {/* Search Stations */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search stations by name, ID, or address..."
                      value={stationSearchQuery}
                      onChange={(e) => {
                        setStationSearchQuery(e.target.value)
                        setCurrentPage(1) // Reset to first page when searching
                      }}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {stationSearchQuery && (
                      <button
                        onClick={() => {
                          setStationSearchQuery('')
                          setCurrentPage(1)
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear search"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {stationSearchQuery && (
                    <div className="mt-2 text-sm text-gray-600">
                      Found {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''} matching "{stationSearchQuery}"
                      {filteredStations.length === 0 && (
                        <span className="text-red-500 ml-2">- No stations found</span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Table Layout */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Select
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Station ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Address
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentStations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                            No stations found matching your search
                          </td>
                        </tr>
                      ) : (
                        currentStations.map(station => {
                          const isChecked = selectedUser && 
                            selectedStations[selectedUser]?.includes(station.id);
                          
                          return (
                            <tr 
                              key={station.id}
                              className={`hover:bg-gray-50 cursor-pointer ${isChecked ? 'bg-blue-50' : ''}`}
                              onClick={() => handleStationToggle(station.id)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={isChecked || false}
                                  onChange={() => {}} // Handled by row click
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{station.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{station.station_id}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 truncate max-w-xs">{station.address}</div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {filteredStations.length > 0 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                    {/* Mobile Pagination */}
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => paginate(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          currentPage === 1
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-white hover:text-gray-900'
                        }`}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </button>
                      
                      <div className="flex items-center space-x-1">
                        <span className="text-sm text-gray-500">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                          currentPage === totalPages
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-white hover:text-gray-900'
                        }`}
                      >
                        Next
                        <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{indexOfFirstStation + 1}</span> to{' '}
                          <span className="font-medium">
                            {Math.min(indexOfLastStation, filteredStations.length)}
                          </span>{' '}
                          of <span className="font-medium">{filteredStations.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => paginate(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 transition-colors ${
                              currentPage === 1
                                ? 'cursor-not-allowed'
                                : 'hover:bg-white hover:text-gray-600'
                            }`}
                          >
                            <span className="sr-only">Previous</span>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* Smart page numbers with ellipsis */}
                          {(() => {
                            const pages = []
                            const maxVisiblePages = 5
                            
                            if (totalPages <= maxVisiblePages) {
                              // Show all pages if total is small
                              for (let i = 1; i <= totalPages; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => paginate(i)}
                                    className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ${
                                      currentPage === i
                                        ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                )
                              }
                            } else {
                              // Show smart pagination with ellipsis
                              const startPage = Math.max(1, currentPage - 2)
                              const endPage = Math.min(totalPages, currentPage + 2)
                              
                              // Always show first page
                              if (startPage > 1) {
                                pages.push(
                                  <button
                                    key={1}
                                    onClick={() => paginate(1)}
                                    className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0"
                                  >
                                    1
                                  </button>
                                )
                                
                                if (startPage > 2) {
                                  pages.push(
                                    <span key="ellipsis1" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700">
                                      ...
                                    </span>
                                  )
                                }
                              }
                              
                              // Show pages around current page
                              for (let i = startPage; i <= endPage; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => paginate(i)}
                                    className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ${
                                      currentPage === i
                                        ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                )
                              }
                              
                              // Always show last page
                              if (endPage < totalPages) {
                                if (endPage < totalPages - 1) {
                                  pages.push(
                                    <span key="ellipsis2" className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700">
                                      ...
                                    </span>
                                  )
                                }
                                
                                pages.push(
                                  <button
                                    key={totalPages}
                                    onClick={() => paginate(totalPages)}
                                    className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-white focus:outline-offset-0"
                                  >
                                    {totalPages}
                                  </button>
                                )
                              }
                            }
                            
                            return pages
                          })()}
                          
                          {/* Next Page Button */}
                          <button
                            onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center px-2 py-2 text-gray-400 transition-colors ${
                              currentPage === totalPages
                                ? 'cursor-not-allowed'
                                : 'hover:bg-white hover:text-gray-600'
                            }`}
                            title="Next Page"
                          >
                            <span className="sr-only">Next</span>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* Last Page Button */}
                          <button
                            onClick={() => paginate(totalPages)}
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 transition-colors ${
                              currentPage === totalPages
                                ? 'cursor-not-allowed'
                                : 'hover:bg-white hover:text-gray-600'
                            }`}
                            title="Last Page"
                          >
                            <span className="sr-only">Last</span>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M4.21 5.23a.75.75 0 011.06-.02L9.168 10l-3.898 3.79a.75.75 0 11-1.04-1.08L7.832 10 4.23 6.29a.75.75 0 01-.02-1.06zm6 0a.75.75 0 011.06-.02L15.168 10l-3.898 3.79a.75.75 0 11-1.04-1.08L13.832 10l-3.598-3.71a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserStationAssignment