'use client';

import { useState, useEffect } from 'react';

export default function AdminRevenuePage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue Management</h1>
        <p className="text-gray-600 mt-1">
          Track and analyze revenue metrics
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <p>Revenue management dashboard</p>
            <p className="text-sm mt-2">This feature is coming soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}