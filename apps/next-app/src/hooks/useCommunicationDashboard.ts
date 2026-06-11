import { useState, useEffect, useCallback } from 'react';
import { useModuleContext } from './useModuleContext';

export function useCommunicationDashboard() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (academicYear?.id) params.append('academicYearId', academicYear.id);
      
      const response = await fetch(`/api/communication/v2/dashboard/stats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch communication stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching communication stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats
  };
}
