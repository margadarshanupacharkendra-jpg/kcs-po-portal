const encoder = new TextEncoder();

async function getKey() {
  const secret = process.env.SESSION_SECRET || "kcs-dev-secret-change-me";
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Session cookie value is "<role>.<hmac signature>" so it can't be forged
// without knowing SESSION_SECRET (set that env var in Vercel for production).
export async function signSession(role) {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(role));
  return `${role}.${toHex(sig)}`;
}

export async function verifySession(cookieValue) {
  if (!cookieValue) return null;
  const [role] = cookieValue.split(".");
  if (!role) return null;
  const expected = await signSession(role);
  return expected === cookieValue ? role : null;
}

// Credentials default to the ones requested, but can be overridden via
// Vercel env vars (Project Settings > Environment Variables) without
// touching code — recommended once this is live.
export function checkCredentials(username, password) {
  const admin = {
    u: process.env.ADMIN_USERNAME || "ksdadmin",
    p: process.env.ADMIN_PASSWORD || "ksd@pw",
  };
  const staff = {
    u: process.env.STAFF_USERNAME || "ksduser",
    p: process.env.STAFF_PASSWORD || "ksd@user",
  };
  if (username === admin.u && password === admin.p) return "admin";
  if (username === staff.u && password === staff.p) return "user";
  return null;
}
