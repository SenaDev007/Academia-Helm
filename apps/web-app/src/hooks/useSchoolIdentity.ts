"use client";

/**
 * Hook pour récupérer l'identité de l'école (nom, logo, contact)
 * depuis l'API /api/settings/identity.
 */

import { useState, useEffect, useCallback } from "react";

export interface SchoolIdentity {
  schoolName: string;
  schoolAcronym?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export function useSchoolIdentity() {
  const [identity, setIdentity] = useState<SchoolIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/identity", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setIdentity({
          schoolName: data.schoolName || "",
          schoolAcronym: data.schoolAcronym,
          logoUrl: data.logoUrl,
          phone: data.phone,
          email: data.email,
          address: data.address,
          website: data.website,
        });
      }
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { identity, loading };
}
