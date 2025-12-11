import React from 'react';
import Card from '../ui/Card';

interface DashboardStatsProps {
  totalJobs: number;
  completedJobs: number;
  runningJobs: number;
  failedJobs: number;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  variant?: 'default' | 'success' | 'processing' | 'error';
}

function StatCard({ title, value, icon, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    processing: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  return (
    <Card padding="md" className={`border ${variantClasses[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </Card>
  );
}

export default function DashboardStats({
  totalJobs,
  completedJobs,
  runningJobs,
  failedJobs,
}: DashboardStatsProps) {
  const successRate =
    totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Total Jobs" value={totalJobs} icon="📊" />
      <StatCard
        title="Completed"
        value={completedJobs}
        icon="✅"
        variant="success"
      />
      <StatCard
        title="Running"
        value={runningJobs}
        icon="⏳"
        variant="processing"
      />
      <StatCard title="Failed" value={failedJobs} icon="❌" variant="error" />
    </div>
  );
}
