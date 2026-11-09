import { VertexAIClient, buildVertexAIClient } from "./VertexAIClient";

/**
 * Building blocks shared by every "Check with AI" answer verification (F13 exercises, F27 words practice),
 * so that the model, the judging rules and the failure semantics of the optional note stay one definition.
 */

/** Model for the answer check. Judging real-world Danish needs more than the smallest tier. Overridable with VERTEX_AI_VERIFICATION_MODEL. */
export const VERIFICATION_MODEL = process.env.VERTEX_AI_VERIFICATION_MODEL ?? "gemini-3.5-flash-lite";

/** Judging considerations common to all verdict prompts: case and punctuation never make an answer invalid. */
export const COMMON_JUDGING_RULES = `- Ignore case, always.
            - Ignore punctuation differences (periods, commas, quotation marks, dashes, etc.), always.`;

/**
 * Returns the injected client, or lazily builds the production client for the verification model.
 *
 * @param {VertexAIClient | null} injected - A client set by a test, if any.
 *
 * @returns {VertexAIClient} The client to use.
 */
export function resolveVerificationClient(injected: VertexAIClient | null): VertexAIClient {

    return injected ?? buildVertexAIClient(VERIFICATION_MODEL);
}

/**
 * Runs the optional "note on a valid answer" step. The note is a nicety: any failure (AI error, unparsable
 * output) yields no note instead of failing the verification, so it can never affect the verdict.
 *
 * @param {VertexAIClient} client - The AI client to call.
 * @param {string} prompt - The fully-formed note prompt. The model must answer `{ explanation?: string }`.
 *
 * @returns {Promise<string | undefined>} The trimmed note, or undefined if there is nothing to add.
 */
export async function generateOptionalNote(client: VertexAIClient, prompt: string): Promise<string | undefined> {

    try {

        const raw = await client.generate(prompt);

        const parsed = JSON.parse(raw) as { explanation?: string };

        return parsed.explanation?.trim() || undefined;

    } catch (error) {

        console.error("Could not generate the note for a valid answer", error);

        return undefined;
    }
}
