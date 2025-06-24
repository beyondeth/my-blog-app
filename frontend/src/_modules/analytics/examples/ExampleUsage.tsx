'use client';

import React from 'react';
import { useAnalytics } from '../core/analytics';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

export default function ExampleUsage() {
  const analytics = useAnalytics();

  const handleTrackClick = () => {
    analytics.trackInteraction('button_click', 'example_button');
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Analytics Example</h2>
      
      <button 
        onClick={handleTrackClick}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Track Click
      </button>

      <AnalyticsDashboard />
    </div>
  );
} 