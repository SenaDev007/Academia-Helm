"use client";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function TeacherCommunicationRedirect() {
  useEffect(() => {
    redirect("/app/communication");
  }, []);
  return null;
}
