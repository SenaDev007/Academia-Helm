"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function TeacherEduCastRedirect() {
  useEffect(() => {
    redirect("/app/educast");
  }, []);
  return null;
}
