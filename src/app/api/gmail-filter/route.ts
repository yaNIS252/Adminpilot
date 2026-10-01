import { NextResponse } from "next/server";

import { inboxAddress, requireUser } from "@/lib/auth/require-user";
import { buildGmailFilterXml } from "@/lib/gmail-filter";
import { forwardingDomains } from "@/lib/forwarding-domains";

export const runtime = "nodejs";

/**
 * Fichier de filtres Gmail de l'utilisateur, à importer dans Gmail.
 *
 * `?mots=0` retire le filtre par mots-clés de l'objet, pour qui ne veut
 * transférer que les e-mails des fournisseurs connus.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const xml = buildGmailFilterXml({
    forwardTo: inboxAddress(auth.profile),
    domains: await forwardingDomains(),
    includeKeywords: new URL(request.url).searchParams.get("mots") !== "0",
  });

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": 'attachment; filename="adminpilot-filtres-gmail.xml"',
      "cache-control": "no-store",
    },
  });
}
