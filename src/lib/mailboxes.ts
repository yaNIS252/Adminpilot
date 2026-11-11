import "server-only";

import { MAILBOX_LIMITS } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Boîtes mail qui transfèrent vers un compte : une en gratuit et en Pro,
 * trois en Premium (la sienne, celle du travail, une ancienne adresse…).
 *
 * Une boîte se fait connaître par la demande de validation de Gmail, qui
 * porte son adresse. Renvoie `false` si elle est nouvelle et que la formule
 * n'en accepte pas davantage. Les messageries sans demande de validation
 * (règles Outlook) ne passent pas par ici et ne sont pas comptées.
 */
export async function registerMailbox(
  db: Db,
  profile: { id: string; plan: Enums<"plan"> },
  address: string,
): Promise<boolean> {
  const normalized = address.trim().toLowerCase();
  const { data: known } = await db.from("mailboxes").select("address").eq("user_id", profile.id);
  const addresses = (known ?? []).map((row) => row.address);
  if (addresses.includes(normalized)) return true;
  if (addresses.length >= MAILBOX_LIMITS[profile.plan]) return false;

  const { error } = await db.from("mailboxes").insert({ user_id: profile.id, address: normalized });
  // 23505 : enregistrée entre-temps par une autre requête, donc connue.
  return !error || error.code === "23505";
}
