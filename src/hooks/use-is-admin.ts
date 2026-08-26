import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/**
 * Presentation-only hint used to show or hide the admin link.
 * Every admin action is authorized again on the server via `has_role`.
 */
export function useIsAdmin() {
  const { session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (!session) {
      setIsAdmin(false);
      return;
    }
    void supabase
      .rpc("has_role", { _user_id: session.user.id, _role: "ADMIN" })
      .then(({ data }) => {
        if (active) setIsAdmin(data === true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  return isAdmin;
}
