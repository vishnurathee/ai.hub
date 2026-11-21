import { createHubDataClient } from "@workspace/ai-hub-ui";

export const hubDataClient = createHubDataClient("/api/hub");
export const { apiRequest, getQueryFn, createQueryClient } = hubDataClient;
