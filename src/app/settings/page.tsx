import { asaConfigured } from "@/lib/searchads";
import { getSetting } from "@/lib/service";
import { AsaConnection } from "@/components/AsaConnection";
import { SettingForm } from "@/components/SettingForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const officialConfigured = asaConfigured();
  const mode = (process.env.ASA_SESSION_MODE ?? "playwright").toLowerCase();
  const cookie = mode === "cookie" ? await getSetting("asa_session_cookie") : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight mb-5">Settings</h1>

      <div className="card px-5 py-4 mb-5">
        <div className="text-[13px] font-semibold mb-1">Apple Ads — official API</div>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-2">
          Status:{" "}
          {officialConfigured ? (
            <span style={{ color: "var(--good)" }}>configured via .env.local</span>
          ) : (
            <span className="text-muted">not configured</span>
          )}
        </p>
        <p className="text-[12.5px] text-muted leading-relaxed">
          In the ASA UI → Account Settings → API: create an API user, generate an ES256 key
          pair, upload the public key, then set ASA_CLIENT_ID, ASA_TEAM_ID, ASA_KEY_ID,
          ASA_PRIVATE_KEY_PATH, and ASA_ORG_ID in <code>.env.local</code> and restart the dev
          server. Used for catalog search and suggested-bid signals.
        </p>
      </div>

      {mode === "cookie" ? (
        <div className="card px-5 py-4 flex flex-col gap-4">
          <div>
            <div className="text-[13px] font-semibold mb-1">
              Apple Ads — popularity scores (manual cookie)
            </div>
            <p className="text-[12.5px] text-muted leading-relaxed">
              Log in to <code>app-ads.apple.com</code>, open DevTools → Network, copy the{" "}
              <code>Cookie</code> header from any request, and paste it below. Set{" "}
              <code>ASA_SESSION_MODE=playwright</code> in <code>.env.local</code> for an automatic
              session that never needs re-pasting.
            </p>
          </div>
          <SettingForm
            settingKey="asa_session_cookie"
            label="ASA session cookie"
            placeholder="Paste the Cookie header value…"
            hasValue={Boolean(cookie)}
            textarea
          />
        </div>
      ) : (
        <AsaConnection />
      )}
    </div>
  );
}
