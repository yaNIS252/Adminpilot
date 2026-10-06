import { FeedbackForm } from "@/components/feedback/feedback-form";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Ton avis — AdminPilot" };

/** Page d'arrivée des étoiles de l'e-mail : la note y est présélectionnée. */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const auth = await requireUser();
  const { note } = await searchParams;
  const fromLink = Number(note);
  const initialRating =
    Number.isInteger(fromLink) && fromLink >= 1 && fromLink <= 5
      ? fromLink
      : (auth?.profile.feedback_rating ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="anim-up">
        <h1 className="serif m-0 text-[36px] leading-[1.05]">Ton avis</h1>
        <p className="m-0 mt-1 max-w-xl text-sm text-[var(--text-dim)]">
          {auth?.profile.feedback_at
            ? "Merci pour ton avis ! Tu peux le modifier à tout moment."
            : "Trente secondes pour nous dire ce que tu en penses. On lit tout."}
        </p>
      </header>
      <section className="card-sheen anim-up max-w-xl rounded-[var(--radius-xl)] border border-[var(--border)] p-5">
        <FeedbackForm
          initialRating={initialRating}
          initialComment={auth?.profile.feedback_comment ?? ""}
        />
      </section>
    </div>
  );
}
