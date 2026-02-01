/**
 * ============================================================================
 * ALERT CARD WIDGET - WIDGET POUR ALERTES ORION
 * ============================================================================
 */

'use client';

interface AlertCardProps {
  title: string;
  count: number;
  level: 'critical' | 'warning' | 'info';
  onClick?: () => void;
}

export function AlertCard({ title, count, level, onClick }: AlertCardProps) {
  const colors = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-4 ${
        colors[level]
      } ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold">{count}</p>
        </div>
        <div className="text-2xl">
          {level === 'critical' && '🚨'}
          {level === 'warning' && '⚠️'}
          {level === 'info' && 'ℹ️'}
        </div>
      </div>
    </div>
  );
}
