import { NextResponse } from "next/server";

import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { buildGmailFilterXml } from "@/lib/gmail-filter";
import { filterFingerprint, forwardingDomains } from "@/lib/forwarding-domains";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Fichier de filtres Gmail de l'utilisateur, à importer dans Gmail.
 *
 * `?mots=1` ajoute le filtre par mots-clés de l'objet. Désactivé par défaut :
 * il capte des expéditeurs inconnus, donc parfois des e-mails personnels.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const domains = await forwardingDomains();
  const xml = buildGmailFilterXml({
    forwardTo: inboxAddress(auth.profile),
    domains,
    includeKeywords: new URL(request.url).searchParams.get("mots") === "1",
  });

  // Empreinte du filtre remis : les réglages proposeront de le réimporter
  // quand le catalogue ou les règles auront changé.
  await createAdminClient()
    .from("profiles")
    .update({ gmail_filter_hash: filterFingerprint(domains) })
    .eq("id", auth.userId);

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": 'attachment; filename="adminpilot-filtres-gmail.xml"',
      "cache-control": "no-store",
    },
  });
}
