"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function TeacherLibraryRedirect() {
  useEffect(() => {
    redirect("/app/library");
  }, []);
  return null;
}
