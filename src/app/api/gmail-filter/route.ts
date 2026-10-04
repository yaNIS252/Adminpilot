import { NextResponse } from "next/server";

import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { buildGmailFilterXml } from "@/lib/gmail-filter";
import { forwardingDomains } from "@/lib/forwarding-domains";

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

  const xml = buildGmailFilterXml({
    forwardTo: inboxAddress(auth.profile),
    domains: await forwardingDomains(),
    includeKeywords: new URL(request.url).searchParams.get("mots") === "1",
  });

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": 'attachment; filename="adminpilot-filtres-gmail.xml"',
      "cache-control": "no-store",
    },
  });
}
