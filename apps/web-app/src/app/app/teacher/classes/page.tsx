"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function TeacherClassesRedirect() {
  useEffect(() => {
    redirect("/app/pedagogy/production");
  }, []);
  return null;
}
