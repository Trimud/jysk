import { chatText, extractJson, fromApp, ipOf, keyTrouble, MODELS, rateLimited, TogetherError, userKey } from "@/lib/together";

const PROMPT = `This photo shows a JYSK product, its box, its label or its assembly manual cover. Read the product name and the product number.
Reply with JSON only: {"name": "LIMFJORDEN", "variant": "4 drawer chest", "productNo": "3670661", "confidence": 0.0-1.0}.
The name is the word in capitals (it may contain Æ, Ø, Å, Ä or Ö). The product number is the 7 digit number in the top-left corner of the box front, printed as "Product no." or at the start of a box label (as in "3670661 - 4 drawer chest"); a manual cover lists one per colour, give the first; it is not the 13 digit barcode number, the order, batch or supplier number. Leave any field you can't read as "". If you can't read a name, guess the kind of furniture in "variant".`;

export async function POST(req: Request) {
  if (!fromApp(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const key = userKey(req);
  if (!key) return Response.json({ error: "key" }, { status: 401 });
  if (rateLimited(ipOf(req) + ":identify", 8)) return Response.json({ error: "slow down" }, { status: 429 });
  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 3_000_000) return Response.json({ error: "bad image" }, { status: 400 });
  try {
    const { text } = await chatText({
      key,
      models: MODELS.vision,
      // vision models think before they answer: a short budget comes back empty (a label with only small print needed ~4000)
      maxTokens: 4000,
      temperature: 0,
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image } }] }],
    });
    const j = extractJson(text) as { name?: string; variant?: string; productNo?: string; confidence?: number } | null;
    const name = (j?.name ?? "").toString().trim();
    const variant = (j?.variant ?? "").toString().trim();
    const productNo = (j?.productNo ?? "").toString().replace(/\D/g, "");
    return Response.json({ name, variant, productNo, query: [name, variant].filter(Boolean).join(" "), confidence: Number(j?.confidence ?? 0) });
  } catch (e) {
    console.error("[identify]", (e as Error).message);
    const trouble = e instanceof TogetherError ? keyTrouble(e.status) : null;
    return Response.json({ error: trouble ?? "failed" }, { status: trouble === "key" ? 401 : trouble === "credits" ? 402 : 502 });
  }
}
