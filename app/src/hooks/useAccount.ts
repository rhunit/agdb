import { useEffect, useState } from "react";
import { fetchMe, hasLiveBackend, type Me, type Permission } from "../lib/api";

interface AccountState {
  account: Me | null;
  /** Whether the logged-in account has `permission`. False while still
   * loading, so permission-gated controls never flash up and vanish. In
   * mock-only mode (no backend) everything is allowed, as before. */
  can: (permission: Permission) => boolean;
}

export function useAccount(): AccountState {
  const [account, setAccount] = useState<Me | null>(null);

  useEffect(() => {
    if (!hasLiveBackend()) return;
    let cancelled = false;
    // Shared, fetched once per page load (see loadSession in ../lib/api) —
    // the reply forms alone can number in the dozens on "Alle reviews".
    fetchMe().then((me) => {
      if (!cancelled) setAccount(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    account,
    can: (permission) =>
      !hasLiveBackend() || (account?.permissions?.includes(permission) ?? false),
  };
}
