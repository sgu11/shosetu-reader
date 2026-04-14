import { getOpenRouterModelPricing } from "@/lib/openrouter/models-cache";

interface ModelPricing {
  promptPricePerToken: number;
  completionPricePerToken: number;
}

export async function estimateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number | null> {
  const pricing = await getModelPricing(modelName);
  if (!pricing) {
    return null;
  }

  return (
    inputTokens * pricing.promptPricePerToken +
    outputTokens * pricing.completionPricePerToken
  );
}

export async function getModelPricing(modelName: string): Promise<ModelPricing | null> {
  return getOpenRouterModelPricing(modelName);
}
