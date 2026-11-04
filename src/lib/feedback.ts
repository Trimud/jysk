import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Where feedback goes. With BREVO_API_KEY and FEEDBACK_TO set, every entry is emailed to FEEDBACK_TO through Brevo,
 * from feedback@mail.assemble.help, with Reply-To set to the sender's address when they left one. In development
 * without them it goes to .feedback/feedback.jsonl. Every entry is logged as well (grep for [feedback]), so nothing
 * is lost if a send fails.
 */

export interface FeedbackEntry {
  id: string;
  at: string;
  kind: "match" | "general";
  slug?: string;
  name?: string;
  variant?: string;
  match?: boolean;
  topic?: string;
  step?: number;
  phase?: string;
  note?: string;
  email?: string;
  via?: string;
  page?: string;
  device?: string;
}

const FROM = { name: "assemble.help feedback", email: "feedback@mail.assemble.help" };

/** "MARSTRAND: doesn't match, step 3" or "Idea: ..." for the inbox list. */
function subject(e: FeedbackEntry) {
  const head = e.kind === "match" ? `${e.name ?? e.slug}: ${e.match ? "matches" : "doesn't match"}` : `${e.topic ?? "Feedback"}`;
  const where = e.step ? `, step ${e.step}` : e.phase ? `, ${e.phase}` : "";
  const note = e.note ? `: ${e.note.replace(/\s+/g, " ").slice(0, 60)}` : "";
  return `${head}${where}${note}`;
}

export async function saveFeedback(entry: FeedbackEntry): Promise<boolean> {
  console.info("[feedback]", JSON.stringify(entry));
  const key = process.env.BREVO_API_KEY;
  const to = process.env.FEEDBACK_TO;
  if (key && to) {
    const { note, ...rest } = entry;
    const fields = Object.entries(rest).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`);
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: FROM,
        to: [{ email: to }],
        ...(entry.email ? { replyTo: { email: entry.email } } : {}),
        subject: subject(entry),
        // ponytail: plain text only, so visitor input never becomes HTML in the inbox.
        textContent: [note ?? "(no note)", "", ...fields].join("\n"),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!r?.ok) console.error("[feedback] send failed", r?.status ?? "network", r && (await r.text().catch(() => "")));
    return !!r?.ok;
  }
  if (process.env.NODE_ENV !== "production") {
    const dir = path.join(process.cwd(), ".feedback");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "feedback.jsonl"), JSON.stringify(entry) + "\n");
  }
  return true;
}
