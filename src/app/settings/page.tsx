import { asaConfigured } from "@/lib/searchads";
import { getSetting } from "@/lib/service";
import { SettingForm } from "@/components/SettingForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cookie = await getSetting("asa_session_cookie");
  const officialConfigured = asaConfigured();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight mb-5">Settings</h1>

      <div className="card px-5 py-4 mb-5">
        <div className="text-[13px] font-semibold mb-1">Apple Search Ads — official API</div>
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

      <div className="card px-5 py-4 flex flex-col gap-4">
        <div>
          <div className="text-[13px] font-semibold mb-1">
            Apple Search Ads — popularity scores (dashboard session)
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed">
            Keyword popularity (5–100) comes from the Apple Ads dashboard’s internal API. Log in
            to <code>app-ads.apple.com</code>, open DevTools → Network, copy the{" "}
            <code>Cookie</code> header from any request, and paste it below. When it expires or
            is missing, research scores fall back to the local difficulty heuristic.
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
    </div>
  );
}
