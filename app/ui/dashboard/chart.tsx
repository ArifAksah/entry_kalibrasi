'use client';

import React, { useEffect, useMemo, useState } from 'react';

const Chart: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [series, setSeries] = useState<{ month: string; count: number }[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/summary')
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load summary')
        setSeries(Array.isArray(body?.certificates?.timeseries) ? body.certificates.timeseries : [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load summary')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const maxValue = useMemo(() => (series.length ? Math.max(...series.map(d => d.count)) : 0), [series])
  const minValue = useMemo(() => (series.length ? Math.min(...series.map(d => d.count)) : 0), [series])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Certificates Issued</h3>
          <p className="text-sm text-gray-600">Monthly totals for the last 12 months</p>
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">12M</button>
          <button className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-full">6M</button>
          <button className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-full">3M</button>
        </div>
      </div>

      {/* Simple Bar Chart */}
      {loading ? (
        <div className="h-64 animate-pulse bg-gray-50 rounded" />
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-red-600">{error}</div>
      ) : (
        <div className="h-64 flex items-end justify-between space-x-1">
          {series.map((item, index) => {
            const height = maxValue === minValue ? 0 : ((item.count - minValue) / (maxValue - minValue)) * 100
            const label = item.month.slice(5)
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500 hover:from-blue-600 hover:to-blue-500" style={{ height: `${height}%` }}></div>
                <span className="text-xs text-gray-500 mt-2">{label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Revenue</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{series.reduce((a, b) => a + b.count, 0)}</p>
          <p className="text-sm text-gray-600">Total certificates in period</p>
        </div>
      </div>
    </div>
  );
};

export default Chart;
