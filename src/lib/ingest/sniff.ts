/**
 * Reconnaissance du type réel d'un fichier par sa signature binaire.
 *
 * Le `Content-Type` d'un `File` est déclaré par le navigateur, donc par le
 * client, donc par n'importe qui : une requête forgée peut annoncer
 * `application/pdf` pour n'importe quel contenu. On ne validait que cette
 * déclaration.
 *
 * L'exposition reste limitée — le bucket est privé, et Supabase resert le type
 * qu'on lui a donné, si bien qu'un contenu HTML étiqueté `image/png` ne
 * s'exécute pas dans un navigateur. Mais un fichier qui n'est pas ce qu'il
 * prétend part quand même chez le modèle, où il consomme un appel pour ne rien
 * produire, et vient polluer le coffre-fort de l'utilisateur. Le refuser à la
 * porte coûte quatre octets de lecture.
 */

const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP : conteneur RIFF, le type réel se lit huit octets plus loin.
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

function startsWith(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Type réel du fichier, ou `null` si aucune signature connue ne correspond. */
export function sniffMimeType(buffer: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    if (!startsWith(buffer, signature.bytes, signature.offset)) continue;

    if (signature.mime === "image/webp") {
      // « WEBP » à l'octet 8 : sans ce contrôle, tout fichier RIFF — un WAV,
      // un AVI — passerait pour une image.
      const webp = [0x57, 0x45, 0x42, 0x50];
      if (!startsWith(buffer, webp, 8)) continue;
    }

    return signature.mime;
  }
  return null;
}
