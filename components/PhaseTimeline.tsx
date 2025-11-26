'use client';

import { PhaseStatuses, PhaseStatusValue } from '@/lib/types/job';

interface PhaseTimelineProps {
  phases: PhaseStatuses | null | undefined;
}

interface PhaseInfo {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  description: string;
}

const PHASE_INFO: PhaseInfo[] = [
  { id: 'A', name: 'Normalize', description: 'Input normalization' },
  { id: 'B', name: 'Analyze & Route', description: 'Quality assessment' },
  { id: 'C', name: 'Export', description: 'Content export' },
  { id: 'D', name: 'Vision', description: 'Vision enrichment' },
];

export default function PhaseTimeline({ phases }: PhaseTimelineProps) {
  const getPhaseStatus = (phaseId: 'A' | 'B' | 'C' | 'D'): PhaseStatusValue => {
    return phases?.[phaseId]?.status || 'not_started';
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: PhaseStatusValue) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
      case 'running':
        return 'bg-blue-500 dark:bg-blue-600 text-white animate-pulse';
      case 'completed':
        return 'bg-green-500 dark:bg-green-600 text-white';
      case 'failed':
        return 'bg-red-500 dark:bg-red-600 text-white';
      default:
        return 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
    }
  };

  const getConnectorColor = (currentStatus: PhaseStatusValue, nextStatus: PhaseStatusValue) => {
    if (currentStatus === 'completed') {
      return 'bg-green-500 dark:bg-green-600';
    }
    return 'bg-gray-300 dark:bg-gray-600';
  };

  const getStatusBadge = (status: PhaseStatusValue) => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Pipeline Phases
      </h2>

      <div className="space-y-4">
        {PHASE_INFO.map((phaseInfo, index) => {
          const status = getPhaseStatus(phaseInfo.id);
          const phaseData = phases?.[phaseInfo.id];
          const nextStatus = index < PHASE_INFO.length - 1 ? getPhaseStatus(PHASE_INFO[index + 1].id) : 'not_started';

          return (
            <div key={phaseInfo.id}>
              <div className="flex items-start gap-4">
                {/* Phase Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getStatusColor(status)}`}
                  >
                    {phaseInfo.id}
                  </div>
                  {index < PHASE_INFO.length - 1 && (
                    <div className={`w-1 h-12 mt-2 ${getConnectorColor(status, nextStatus)}`} />
                  )}
                </div>

                {/* Phase Details */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      Phase {phaseInfo.id}: {phaseInfo.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        status === 'not_started'
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          : status === 'running'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}
                    >
                      {getStatusBadge(status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {phaseInfo.description}
                  </p>

                  {/* Timestamps */}
                  {(phaseData?.startedAt || phaseData?.completedAt) && (
                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {phaseData?.startedAt && (
                        <div>
                          <span className="font-medium">Started:</span>{' '}
                          {formatTimestamp(phaseData.startedAt)}
                        </div>
                      )}
                      {phaseData?.completedAt && (
                        <div>
                          <span className="font-medium">Completed:</span>{' '}
                          {formatTimestamp(phaseData.completedAt)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {phaseData?.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                      <span className="font-medium">Error:</span> {phaseData.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
