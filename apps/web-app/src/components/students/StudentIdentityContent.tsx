/**
 * ============================================================================
 * SOUS-MODULE B — IDENTITÃ‰ & RELATIONS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { User, Shield, Users, Mail, Phone, FileCheck, AlertCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  npi?: string;
  legalDocumentType?: string;
  legalDocumentNumber?: string;
  status: string;
  studentGuardians: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    guardian: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
    };
  }>;
}

export default function StudentIdentityContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (academicYear && schoolLevel) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeGuardians: 'true',
      };
      const data = await studentsService.getAll(params);
      setStudents(data);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les étudiants', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingState message="Chargement des identitÃ©s..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">VÃ©rification de l'IdentitÃ© LÃ©gale</h3>
            <p className="text-sm text-gray-500">Gestion des NPI, documents officiels et relations parentales</p>
          </div>
        </div>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Rechercher un Ã©lÃ¨ve..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <div key={student.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 leading-tight">{student.lastName}</h4>
                  <p className="text-sm text-gray-600">{student.firstName}</p>
                </div>
              </div>
              <div className="text-right text-[10px] font-mono text-gray-400">
                {student.matricule || 'SANS MATRICULE'}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Section NPI / Document */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><FileCheck className="w-3 h-3" /> NPI / IdentitÃ©</span>
                  {student.npi ? (
                    <span className="font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">ValidÃ©</span>
                  ) : (
                    <span className="font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Incomplet
                    </span>
                  )}
                </div>
                <div className="bg-gray-50 p-2 rounded-lg text-sm font-mono text-gray-700 truncate">
                  {student.npi || 'NumÃ©ro NPI non renseignÃ©'}
                </div>
              </div>

              {/* Section Parents */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> Parents / Tuteurs</span>
                  <span className="text-gray-400">{student.studentGuardians.length} contact(s)</span>
                </div>
                <div className="space-y-2">
                  {student.studentGuardians.map((sg) => (
                    <div key={sg.id} className="p-2 border border-gray-100 rounded-lg text-xs hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-800">{sg.guardian.lastName} {sg.guardian.firstName}</span>
                        {sg.isPrimary && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">Principal</span>}
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        {sg.guardian.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sg.guardian.phone}</span>}
                        {sg.guardian.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sg.guardian.email}</span>}
                      </div>
                    </div>
                  ))}
                  {student.studentGuardians.length === 0 && (
                    <div className="text-center py-2 text-xs text-gray-400 italic">Aucun parent associÃ©</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button 
                onClick={async () => {
                  try {
                    if (!academicYear?.id) return;
                    await studentsService.downloadAcademicDossier(student.id, academicYear.id);
                  } catch (e: any) {
                    toast({ title: 'Erreur', description: 'Erreur lors du téléchargement du dossier', variant: 'error' });
                  }
                }}
                className="text-[11px] font-medium text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
              >
                <FileCheck className="w-3 h-3" /> Dossier PDF
              </button>
              <button className="text-[11px] font-medium text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors">
                Pièces jointes
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
