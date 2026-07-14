import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Apple Ads (Search Ads) API OAuth2 client-credentials flow.
 * Setup (one-time, in the ASA UI → Account Settings → API):
 *   1. create an API user and generate an ES256 key pair
 *   2. upload the public key; note clientId / teamId / keyId
 *   3. set ASA_CLIENT_ID, ASA_TEAM_ID, ASA_KEY_ID, ASA_PRIVATE_KEY_PATH, ASA_ORG_ID
 */

export interface AsaConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKeyPath: string;
  orgId: string;
}

export function getAsaConfig(): AsaConfig | null {
  const { ASA_CLIENT_ID, ASA_TEAM_ID, ASA_KEY_ID, ASA_PRIVATE_KEY_PATH, ASA_ORG_ID } = process.env;
  if (!ASA_CLIENT_ID || !ASA_TEAM_ID || !ASA_KEY_ID || !ASA_PRIVATE_KEY_PATH || !ASA_ORG_ID) {
    return null;
  }
  return {
    clientId: ASA_CLIENT_ID,
    teamId: ASA_TEAM_ID,
    keyId: ASA_KEY_ID,
    privateKeyPath: ASA_PRIVATE_KEY_PATH,
    orgId: ASA_ORG_ID,
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function buildClientSecret(cfg: AsaConfig): Promise<string> {
  const pem = readFileSync(cfg.privateKeyPath, "utf8");
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setSubject(cfg.clientId)
    .setIssuer(cfg.teamId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 86400)
    .sign(key);
}

export async function getAccessToken(): Promise<string> {
  const cfg = getAsaConfig();
  if (!cfg) throw new Error("Apple Search Ads credentials not configured (see .env.local)");

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientSecret = await buildClientSecret(cfg);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: clientSecret,
    scope: "searchadsorg",
  });

  const res = await fetch("https://appleid.apple.com/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`ASA token exchange failed: HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}
