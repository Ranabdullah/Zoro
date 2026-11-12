export function backendConfig(url, key) {
  const projectUrl = String(url || "")
    .trim()
    .replace(/\/$/, "");
  const publishableKey = String(key || "").trim();
  if (!/^https:\/\/[a-z0-9]{10,40}\.supabase\.co$/.test(projectUrl))
    throw Error(
      "Enter the HTTPS project URL from Supabase, such as https://yourproject.supabase.co.",
    );
  if (!/^sb_publishable_[A-Za-z0-9_-]{10,180}$/.test(publishableKey))
    throw Error(
      "Use only the sb_publishable_ key. Never enter a secret key, service-role key or database password.",
    );
  return { url: projectUrl, key: publishableKey };
}
