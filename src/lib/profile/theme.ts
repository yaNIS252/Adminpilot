import {
  ACCENTS,
  BACKGROUNDS,
  isAccentId,
  isBackgroundId,
  type AccentId,
  type BackgroundId,
} from "@/lib/constants";
import type { Profile } from "@/lib/supabase/types";

/**
 * Thème réellement affiché.
 *
 * Liste fermée côté base, revérifiée ici : la valeur finit dans un attribut
 * HTML. Et un compte repassé en gratuit perd les teintes réservées aux
 * formules payantes — son choix est conservé en base et revient s'il se
 * réabonne, sans qu'on ait à y toucher.
 */
export function effectiveTheme(
  profile: Pick<Profile, "accent" | "background" | "plan">,
): { accent: AccentId; background: BackgroundId } {
  const paid = profile.plan !== "free";

  const accent = isAccentId(profile.accent) ? profile.accent : "violet";
  const background = isBackgroundId(profile.background)
    ? profile.background
    : "nuit";

  return {
    accent:
      paid || ACCENTS.find((item) => item.id === accent)?.free ? accent : "violet",
    background:
      paid || BACKGROUNDS.find((item) => item.id === background)?.free
        ? background
        : "nuit",
  };
}
