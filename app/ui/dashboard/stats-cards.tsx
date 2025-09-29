'use client';

import React, { useEffect, useState } from 'react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType, icon, color }) => {
  const changeColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className={`text-sm ${changeColor[changeType]} flex items-center mt-1`}>
            <span className="mr-1">
              {changeType === 'positive' && '↗'}
              {changeType === 'negative' && '↘'}
              {changeType === 'neutral' && '→'}
            </span>
            {change}
          </p>
        </div>
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
};

const StatsCards: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/summary')
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load dashboard')
        setData(body)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totals = data?.totals || { sensors: 0, stations: 0, certificates: 0, calibration_results: 0 }
  const certs = data?.certificates || { thisMonth: 0, lastMonth: 0, changePercent: 0 }

  const stats = [
    { title: 'Sensors', value: String(totals.sensors), change: '—', changeType: 'neutral' as const, icon: '🛰️', color: 'bg-blue-100' },
    { title: 'Stations', value: String(totals.stations), change: '—', changeType: 'neutral' as const, icon: '🏛️', color: 'bg-amber-100' },
    { title: 'Certificates Issued', value: String(totals.certificates), change: `${certs.changePercent >= 0 ? '+' : ''}${certs.changePercent}% vs last month`, changeType: certs.changePercent > 0 ? 'positive' as const : certs.changePercent < 0 ? 'negative' as const : 'neutral' as const, icon: '📄', color: 'bg-green-100' },
    { title: 'Calibration Results', value: String(totals.calibration_results), change: '—', changeType: 'neutral' as const, icon: '🧪', color: 'bg-purple-100' },
  ]

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"><div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse h-28"></div><div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse h-28"></div><div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse h-28"></div><div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse h-28"></div></div>
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <StatCard key={index} title={stat.title} value={stat.value} change={stat.change} changeType={stat.changeType} icon={stat.icon} color={stat.color} />
      ))}
    </div>
  )
}

export default StatsCards;
