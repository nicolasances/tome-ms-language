import { VertexAI } from "@google-cloud/vertexai";

/**
 * Contract for calling Vertex AI to generate a mistake explanation.
 * Injectable so delegates can be unit-tested without a live GCP call.
 */
export interface VertexAIClient {

    /**
     * Sends a prompt to the model and returns the raw text of the first candidate.
     *
     * @param {string} prompt - The fully-formed prompt to send.
     *
     * @returns {Promise<string>} The model's raw text response.
     */
    generate(prompt: string): Promise<string>;

}

/**
 * Production implementation that calls Vertex AI directly using ambient GCP
 * service account credentials (standard for Cloud Run services in this project).
 */
export class VertexAIClientImpl implements VertexAIClient {

    private model: string;        // Vertex AI model id, e.g. "gemini-2.5-flash-lite"
    private projectId: string;    // GCP project id, read from GCP_PID env var
    private location: string;     // Vertex AI region, read from VERTEX_AI_LOCATION env var

    constructor({ model, projectId, location }: VertexAIClientImplInput) {

        this.model = model;
        this.projectId = projectId;
        this.location = location;

    }

    /**
     * Sends a prompt to the configured Vertex AI model and returns the response text.
     * Uses `responseMimeType: 'application/json'` so the model returns structured JSON.
     *
     * @param {string} prompt - The fully-formed prompt to send.
     *
     * @returns {Promise<string>} Raw JSON string from the model's first candidate.
     */
    async generate(prompt: string): Promise<string> {

        const vertexAI = new VertexAI({ project: this.projectId, location: this.location });

        const generativeModel = vertexAI.getGenerativeModel({
            model: this.model,
            generationConfig: { responseMimeType: "application/json" },
        });

        const result = await generativeModel.generateContent(prompt);

        const candidate = result.response?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (!text) throw new Error("Vertex AI returned no content");

        return text;

    }

}

/**
 * Builds a VertexAIClientImpl from standard environment variables.
 * GCP_PID must be set; VERTEX_AI_LOCATION defaults to "europe-west1".
 */
export function buildVertexAIClient(): VertexAIClient {

    const projectId = process.env.GCP_PID;
    if (!projectId) throw new Error("GCP_PID env var is not set");

    const location = process.env.VERTEX_AI_LOCATION ?? "europe-west1";

    return new VertexAIClientImpl({ model: "gemini-2.5-flash-lite", projectId, location });

}

interface VertexAIClientImplInput {
    model: string;      // Vertex AI model id
    projectId: string;  // GCP project id
    location: string;   // Vertex AI region
}
