import React from 'react';
import TableCard, { TableData } from './TableCard';
import Skeleton from '../ui/Skeleton';

interface TableListProps {
  tables: TableData[];
  jobId: string;
  isLoading?: boolean;
}

export default function TableList({ tables, jobId, isLoading }: TableListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="150px" />
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Tables Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          This document doesn't contain any detected tables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} jobId={jobId} />
      ))}
    </div>
  );
}
