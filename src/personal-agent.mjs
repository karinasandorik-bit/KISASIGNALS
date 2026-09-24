import OpenAI from "openai";
import crypto from "node:crypto";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.KISA_AGENT_MODEL || "gpt-5.6";
const MODE = process.env.KISA_AGENT_MODE || "shadow";

const constitution = `
You are the KISASIGNALS personal agent runtime.
Operate as an evidence-first orchestrator, not an autonomous money manager.
Never claim an action happened without tool/runtime evidence.
Trading authority is SHADOW by default. Never place a live order.
Given a frozen market snapshot, return JSON only with:
summary, regime, hypotheses, missing_information, trade_intent, vetoes, next_action.
trade_intent must contain symbol, side (LONG|SHORT|NONE), entry_type,
entry_zone, expiry, stop_loss, take_profits, max_loss_usd, rationale,
and evidence_ids. If evidence is insufficient or contradictory, side=NONE.
`;

export async function analyzeSnapshot(snapshot) {
  const snapshotId = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const response = await client.responses.create({
    model: MODEL,
    instructions: constitution,
    input: JSON.stringify({ mode: MODE, snapshot_id: snapshotId, snapshot }),
    text: { format: { type: "json_object" } }
  });
  return {
    snapshot_id: snapshotId,
    model: MODEL,
    mode: MODE,
    created_at: new Date().toISOString(),
    analysis: JSON.parse(response.output_text)
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    console.error("Provide a frozen market snapshot JSON on stdin.");
    process.exit(2);
  }
  const result = await analyzeSnapshot(JSON.parse(raw));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
