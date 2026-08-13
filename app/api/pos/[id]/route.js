import { kv } from "../../../../lib/kv";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../../../lib/auth";

const INDEX_KEY = "po:index";

async function getRole() {
  const c = cookies().get("kcs_session")?.value;
  return verifySession(c);
}

function parse(r) {
  if (!r) return null;
  return typeof r === "string" ? JSON.parse(r) : r;
}

async function loadAll() {
  const ids = await kv.smembers(INDEX_KEY);
  if (!ids || ids.length === 0) return [];
  const records = await kv.mget(...ids.map((id) => `po:${id}`));
  return records.map(parse).filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Edit and delete are admin-only — enforced here, not just hidden in the UI,
// so a "user" account can't reach these by calling the API directly.
export async function PUT(req, { params }) {
  const role = await getRole();
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const existing = parse(await kv.get(`po:${params.id}`));
  if (!existing) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  const updated = await req.json();
  await kv.set(`po:${params.id}`, updated);
  return NextResponse.json({ ok: true, list: await loadAll() });
}

export async function DELETE(req, { params }) {
  const role = await getRole();
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  await kv.del(`po:${params.id}`);
  await kv.srem(INDEX_KEY, params.id);
  return NextResponse.json({ ok: true, list: await loadAll() });
}
