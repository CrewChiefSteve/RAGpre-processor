import React from 'react';

interface JobStatsProps {
  stats: {
    diagrams?: number;
    tables?: number;
    narrativeChunks?: number;
    autoOk?: number;
    needsReview?: number;
  };
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'warning';
}

function StatCard({ icon, label, value, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  };

  return (
    <div className={`flex-1 p-4 border rounded-lg ${variantClasses[variant]}`}>
      <div className="text-center">
        <div className="text-3xl mb-1">{icon}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {value}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export default function JobStats({ stats }: JobStatsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Processing Results
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon="🖼️"
          label="Diagrams"
          value={stats.diagrams ?? 0}
        />
        <StatCard
          icon="📋"
          label="Tables"
          value={stats.tables ?? 0}
        />
        <StatCard
          icon="📝"
          label="Chunks"
          value={stats.narrativeChunks ?? 0}
        />
        <StatCard
          icon="✅"
          label="Auto OK"
          value={stats.autoOk ?? 0}
          variant="success"
        />
        <StatCard
          icon="⚠️"
          label="Review"
          value={stats.needsReview ?? 0}
          variant="warning"
        />
      </div>
    </div>
  );
}
