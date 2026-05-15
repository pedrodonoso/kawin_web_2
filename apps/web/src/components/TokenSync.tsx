"use client";

import { useEffect } from "react";

export function TokenSync() {
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=2592000`;
    }
  }, []);
  return null;
}
