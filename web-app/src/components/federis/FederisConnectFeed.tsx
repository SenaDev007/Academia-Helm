/**
 * FederisConnectFeed Component
 * 
 * Le fil d'actualité institutionnel Federis Connect
 * Inspiré de LinkedIn/Facebook Groups pour le contexte scolaire
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Post {
  id: string;
  type: 'GROUP' | 'COMMUNITY' | 'OFFICIAL';
  user: { firstName: string, lastName: string, avatarUrl?: string };
  content: string;
  groupName?: string;
  communityName?: string;
  createdAt: string;
  reactionsCount: number;
  commentsCount: number;
}

export default function FederisConnectFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation chargement posts
    setTimeout(() => {
      setPosts([
        {
          id: '1',
          type: 'OFFICIAL',
          user: { firstName: 'Bureau', lastName: 'National' },
          content: "L'organisation des épreuves pratiques du BEPC 2024 commencera le lundi prochain. Veuillez consulter le calendrier officiel dans l'onglet Documents.",
          createdAt: new Date().toISOString(),
          reactionsCount: 45,
          commentsCount: 12
        },
        {
          id: '2',
          type: 'GROUP',
          user: { firstName: 'Marc', lastName: 'Zinsou' },
          groupName: 'Directeurs Littoral',
          content: "Est-ce que certains d'entre vous ont déjà reçu les nouveaux livrets de composition ?",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          reactionsCount: 8,
          commentsCount: 5
        },
        {
          id: '3',
          type: 'COMMUNITY',
          user: { firstName: 'Alice', lastName: 'Houngbo' },
          communityName: 'Communauté Pédagogique',
          content: "Voici un guide de préparation pour l'épreuve d'Anglais. N'hésitez pas à partager vos ressources !",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          reactionsCount: 120,
          commentsCount: 24
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Zone de publication */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center font-black text-blue-700">
            M
          </div>
          <button className="flex-1 text-left px-5 py-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 text-sm font-medium transition-all">
            Partagez une information avec la communauté...
          </button>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex items-center space-x-6">
            <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 text-xs font-bold transition-all">
              <AppIcon name="document" size="submenu" />
              <span>Document</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 hover:text-green-600 text-xs font-bold transition-all">
              <AppIcon name="dashboard" size="submenu" />
              <span>Sondage</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 hover:text-purple-600 text-xs font-bold transition-all">
              <AppIcon name="exams" size="submenu" />
              <span>Événement</span>
            </button>
          </div>
          <button className="px-6 py-2 bg-blue-900 text-white rounded-full text-xs font-black shadow-md hover:bg-blue-800 transition-all">
            Publier
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Synchronisation du réseau...</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:border-blue-100">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600">
                      {post.user.firstName[0]}{post.user.lastName[0]}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-black text-gray-900">{post.user.firstName} {post.user.lastName}</h4>
                        {post.type === 'OFFICIAL' && (
                          <span className="bg-blue-900 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black flex items-center gap-1">
                            <AppIcon name="sparkles" size="menu" className="w-2 h-2" />
                            OFFICIEL
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        {post.type === 'GROUP' ? `Dans ${post.groupName}` : post.type === 'COMMUNITY' ? `Dans ${post.communityName}` : 'Communication Federis'}
                        {' • '}
                        {new Date(post.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
                    <AppIcon name="settings" size="menu" />
                  </button>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed font-medium">
                  {post.content}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-1.5 text-gray-500 hover:text-blue-600 transition-all">
                      <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center">
                        <AppIcon name="sparkles" size="menu" className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">{post.reactionsCount}</span>
                    </button>
                    <button className="flex items-center space-x-1.5 text-gray-500 hover:text-indigo-600 transition-all">
                      <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center">
                        <AppIcon name="document" size="menu" className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">{post.commentsCount}</span>
                    </button>
                  </div>
                  <button className="flex items-center space-x-2 text-gray-400 hover:text-gray-900 text-xs font-bold">
                    <AppIcon name="bell" size="menu" className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
