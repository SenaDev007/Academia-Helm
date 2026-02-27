/**
 * ============================================================================
 * SOUS-MODULE : ASSIDUITÉ
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

interface AttendanceRecord {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
  };
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string;
}

export default function AttendancePage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadAttendance();
      loadStatistics();
    }
  }, [academicYear, schoolLevel, selectedDate]);

  const loadAttendance = async () => {
    if (!academicYear || !schoolLevel || schoolLevel.id === 'ALL') return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
        date: selectedDate,
      });

      const response = await fetch(`/api/attendance?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!academicYear || !schoolLevel || schoolLevel.id === 'ALL') return;

    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const response = await fetch(`/api/attendance/statistics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'ABSENT':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'LATE':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'EXCUSED':
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PRESENT: 'Présent',
      ABSENT: 'Absent',
      LATE: 'Retard',
      EXCUSED: 'Excusé',
    };
    return labels[status] || status;
  };

  return (
      <ModuleContainer
      header={{
        title: 'Assiduité',
        description: 'Enregistrement quotidien de la présence des élèves',
        icon: 'calendar',
        kpis: statistics
          ? [
              {
                label: 'Présents',
                value: statistics.present || 0,
                icon: 'checkCircle',
                trend: 'up',
              },
              {
                label: 'Absents',
                value: statistics.absent || 0,
                icon: 'xCircle',
                trend: 'down',
              },
              {
                label: 'Taux présence',
                value: `${statistics.presentRate?.toFixed(1) || 0}%`,
                icon: 'trendingUp',
                trend: 'neutral',
              },
            ]
          : [],
      }}
      content={{
        layout: 'table',
        filters: (
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ),
        isLoading,
        children: (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Élève
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {record.student.lastName} {record.student.firstName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {record.student.studentCode}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(record.status)}
                      <span className="text-sm text-gray-900">
                        {getStatusLabel(record.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      }}
    />
  );
}

