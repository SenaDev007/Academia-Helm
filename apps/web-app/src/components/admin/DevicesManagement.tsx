/**
 * Devices Management Component
 * 
 * Interface de gestion des appareils pour le Super Admin
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Shield, 
  ShieldOff, 
  Trash2, 
  Eye, 
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api/client';

interface Device {
  id: string;
  userId: string;
  tenantId: string;
  deviceName: string | null;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  isTrusted: boolean;
  lastUsedAt: string | null;
  trustedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  _count: {
    deviceSessions: number;
    otpCodes: number;
  };
}

interface DeviceStats {
  totalDevices: number;
  trustedDevices: number;
  revokedDevices: number;
  activeSessions: number;
  pendingOtp: number;
}

export default function DevicesManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    tenantId: '',
    userId: '',
    isTrusted: '',
    search: '',
  });

  useEffect(() => {
    loadDevices();
    loadStats();
  }, [filters]);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.tenantId) params.append('tenantId', filters.tenantId);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.isTrusted) params.append('isTrusted', filters.isTrusted);

      const response = await apiClient.get(`/admin/devices?${params.toString()}`);
      setDevices(response.data.devices || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des appareils');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/admin/devices/stats/overview');
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cet appareil ?')) {
      return;
    }

    try {
      await apiClient.delete(`/admin/devices/${deviceId}`);
      await loadDevices();
      await loadStats();
      
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la révocation');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'desktop':
        return <Monitor className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Smartphone className="w-5 h-5" />;
    }
  };

  const filteredDevices = devices.filter((device) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        device.user.email.toLowerCase().includes(searchLower) ||
        device.tenant.name.toLowerCase().includes(searchLower) ||
        (device.deviceName || '').toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Gestion des Appareils</h1>
        <p className="text-slate-600">Suivi et gestion des appareils connectés à Academia Helm</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Total Appareils</p>
            <p className="text-2xl font-bold text-navy-900">{stats.totalDevices}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Appareils Trusted</p>
            <p className="text-2xl font-bold text-green-600">{stats.trustedDevices}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Appareils Révoqués</p>
            <p className="text-2xl font-bold text-red-600">{stats.revokedDevices}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Sessions Actives</p>
            <p className="text-2xl font-bold text-blue-600">{stats.activeSessions}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-slate-600 mb-1">OTP en Attente</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingOtp}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par email, établissement, nom d'appareil..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filters.isTrusted}
            onChange={(e) => setFilters({ ...filters, isTrusted: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les appareils</option>
            <option value="true">Trusted uniquement</option>
            <option value="false">Non trusted uniquement</option>
          </select>
          <Button onClick={loadDevices} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Appareil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Établissement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Dernière Utilisation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun appareil trouvé
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-400">{getDeviceIcon(device.deviceType)}</div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {device.deviceName || `${device.deviceType} (${device.id.substring(0, 8)}...)`}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{device.deviceType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {device.user.firstName} {device.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{device.user.email}</p>
                        {device.user.role && (
                          <p className="text-xs text-gray-400 capitalize">{device.user.role.toLowerCase()}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.tenant.name}</p>
                        <p className="text-xs text-gray-500">{device.tenant.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {device.isTrusted ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          <Shield className="w-3 h-3 mr-1" />
                          Trusted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
                          <ShieldOff className="w-3 h-3 mr-1" />
                          Non Trusted
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {device._count.deviceSessions} session(s)
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {device.lastUsedAt
                        ? new Date(device.lastUsedAt).toLocaleString('fr-FR')
                        : 'Jamais'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDevice(device)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeDevice(device.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device Details Modal */}
      {selectedDevice && (
        <DeviceDetailsModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onRevoke={() => {
            revokeDevice(selectedDevice.id);
            setSelectedDevice(null);
          }}
        />
      )}
    </div>
  );
}

interface DeviceDetailsModalProps {
  device: Device;
  onClose: () => void;
  onRevoke: () => void;
}

function DeviceDetailsModal({ device, onClose, onRevoke }: DeviceDetailsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Détails de l'Appareil</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Appareil */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Appareil</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="font-medium text-gray-900">
                {device.deviceName || 'Appareil sans nom'}
              </p>
              <p className="text-sm text-gray-500 capitalize">{device.deviceType}</p>
              <p className="text-xs text-gray-400 mt-1">ID: {device.id}</p>
            </div>
          </div>

          {/* Utilisateur */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Utilisateur</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="font-medium text-gray-900">
                {device.user.firstName} {device.user.lastName}
              </p>
              <p className="text-sm text-gray-500">{device.user.email}</p>
              {device.user.role && (
                <p className="text-xs text-gray-400 capitalize mt-1">{device.user.role.toLowerCase()}</p>
              )}
            </div>
          </div>

          {/* Établissement */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Établissement</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="font-medium text-gray-900">{device.tenant.name}</p>
              <p className="text-sm text-gray-500">{device.tenant.slug}</p>
            </div>
          </div>

          {/* Statut */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Statut</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <div className="flex items-center space-x-2">
                {device.isTrusted ? (
                  <>
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="text-green-600 font-medium">Appareil Trusted</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-5 h-5 text-orange-600" />
                    <span className="text-orange-600 font-medium">Non Trusted</span>
                  </>
                )}
              </div>
              {device.trustedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Trusted le: {new Date(device.trustedAt).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </div>

          {/* Statistiques */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Statistiques</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Sessions actives</p>
                  <p className="text-lg font-semibold text-gray-900">{device._count.deviceSessions}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">OTP générés</p>
                  <p className="text-lg font-semibold text-gray-900">{device._count.otpCodes}</p>
                </div>
              </div>
              {device.lastUsedAt && (
                <p className="text-xs text-gray-500 mt-4">
                  Dernière utilisation: {new Date(device.lastUsedAt).toLocaleString('fr-FR')}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Créé le: {new Date(device.createdAt).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {device.isTrusted && (
              <Button variant="destructive" onClick={onRevoke}>
                <Trash2 className="w-4 h-4 mr-2" />
                Révoquer l'Appareil
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
