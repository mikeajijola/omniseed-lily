import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function inferenceConfiguration(env = process.env) {
  const provider = env.LILY_INFERENCE_PROVIDER;
  const model = env.LILY_MODEL;
  if (provider !== "google") throw new Error("Lily requires a declared supported inference Provider.");
  if (!/^gemini-[A-Za-z0-9._-]+$/.test(model ?? "")) throw new Error("Lily requires an exact declared Gemini model identifier.");
  return { provider, model };
}

export function resolveInferenceModel(env = process.env) {
  const configuration = inferenceConfiguration(env);
  // The SDK resolves GOOGLE_GENERATIVE_AI_API_KEY only when the deployed
  // runtime invokes Google. No credential value is evaluated or bundled by
  // Eve's build step.
  const google = createGoogleGenerativeAI();
  return google(configuration.model);
}
