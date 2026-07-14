import { getAccessToken, getAsaConfig } from "./auth";

const BASE = "https://api.searchads.apple.com/api/v5";

export function asaConfigured(): boolean {
  return getAsaConfig() !== null;
}

async function asaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getAsaConfig();
  if (!cfg) throw new Error("Apple Search Ads credentials not configured");
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-AP-Context": `orgId=${cfg.orgId}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`ASA API ${path}: HTTP ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getCampaigns(): Promise<any[]> {
  const data = await asaFetch<any>("/campaigns?limit=50");
  return data?.data ?? [];
}

/** Search the App Store catalog through the Ads API (includes apps you don't own). */
export async function searchAppsAsa(query: string, limit = 20): Promise<any[]> {
  const data = await asaFetch<any>(
    `/search/apps?query=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return data?.data ?? [];
}

/**
 * Suggested-bid recommendations for keywords in an ad group — a demand-strength
 * signal. Requires at least one campaign + ad group in the account.
 */
export async function getBidRecommendations(
  campaignId: number,
  adGroupId: number,
  keywords: string[],
): Promise<any[]> {
  const data = await asaFetch<any>(
    `/campaigns/${campaignId}/adgroups/${adGroupId}/bidrecommendations`,
    {
      method: "POST",
      body: JSON.stringify(keywords.map((text) => ({ text, matchType: "EXACT" }))),
    },
  );
  return data?.data ?? [];
}
