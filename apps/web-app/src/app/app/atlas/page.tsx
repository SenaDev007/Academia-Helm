/**
 * Page IA ATLAS
 * 
 * Assistant conversationnel institutionnel
 */

import { Metadata } from 'next';
import AtlasChatContainer from '@/components/atlas/AtlasChatContainer';

export const metadata: Metadata = {
  title: 'ATLAS - Assistant IA | Academia Helm',
  description: 'Posez vos questions à ATLAS, votre assistant IA de direction.',
};

export default function AtlasPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ATLAS</h1>
        <p className="text-gray-600 mt-1">
          Assistant d'Intelligence Artificielle Institutionnel
        </p>
      </div>
      
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <AtlasChatContainer />
      </div>
    </div>
  );
}
