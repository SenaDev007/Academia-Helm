'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import Link from 'next/link';
import { FileText, BookOpen, Book, CalendarDays } from 'lucide-react';

export default function PedagogicalWorkspacePage() {
  const links = [
    { href: '/app/pedagogy/lesson-plans', label: 'Fiches pédagogiques', icon: FileText },
    { href: '/app/pedagogy/daily-logs', label: 'Cahier journal', icon: BookOpen },
    { href: '/app/pedagogy/class-diaries', label: 'Cahier de texte', icon: Book },
    { href: '/app/pedagogy/semainier', label: 'Cahier du semainier', icon: CalendarDays },
  ];
  return (
    <ModuleContainer
      header={{
        title: 'Espace pédagogique',
        description: 'Fiches, cahier journal, cahier de texte, semainier',
        icon: 'bookOpen',
      }}
      content={{
        layout: 'grid',
        children: links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="bg-white rounded-lg border p-6 hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-semibold">{item.label}</span>
              </div>
            </Link>
          );
        }),
      }}
    />
  );
}
