import * as Sentry from "@sentry/nextjs";

import { SENTRY_DSN, sentryOptions } from "@/lib/monitoring/sentry-options";

// Navigateur : erreurs JavaScript non rattrapées. Pas d'enregistrement de
// session (replay) : il filmerait des écrans pleins de données personnelles.
if (SENTRY_DSN) {
  Sentry.init(sentryOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
