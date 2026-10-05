import "server-only";

import { after } from "next/server";

/**
 * Réveille la file d'analyse juste après avoir répondu.
 *
 * Un simple `void fetch(...)` lancé avant de répondre était parfois coupé :
 * la fonction serverless s'arrête dès la réponse envoyée, et la requête
 * partait ou non selon le moment. L'e-mail restait alors en attente jusqu'à
 * la tâche planifiée du lendemain. `after()` garde la fonction en vie le
 * temps que l'analyse soit lancée et terminée.
 */
export function wakeDrain(requestUrl: string) {
  after(async () => {
    try {
      await fetch(new URL("/api/cron/process-jobs", requestUrl), {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
    } catch {
      // La tâche planifiée rattrapera.
    }
  });
}
