"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function TeacherPedagogyRedirect() {
  useEffect(() => {
    redirect("/app/pedagogy/production");
  }, []);
  return null;
}
