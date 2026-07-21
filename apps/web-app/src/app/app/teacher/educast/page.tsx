"use client";

/**
 * Teacher EduCast — redirects to the EduCast module.
 */

import { redirect } from "next/navigation";
import { useEffect } from "react";
import { Video } from "lucide-react";

export default function TeacherEduCastPage() {
  useEffect(() => {
    redirect("/app/educast");
  }, []);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Video className="h-5 w-5 text-pink-600" />
          <h2 className="text-lg font-bold text-slate-900">EduCast</h2>
        </div>
        <p className="text-sm text-slate-500">Redirection vers EduCast…</p>
      </div>
    </div>
  );
}
