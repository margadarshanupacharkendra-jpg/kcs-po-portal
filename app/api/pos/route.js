import { kv } from "../../../lib/kv";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../../lib/auth";

// Each PO is stored under its own key (po:<id>), with the set of ids kept
// in po:index. This means two people saving at the same moment can never
// overwrite each other's record — unlike a single shared JSON blob.
const INDEX_KEY = "po:index";
const COUNTER_KEY = "po:counter";

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

export async function GET() {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(await loadAll());
}

// Create only — both "admin" and "user" roles may add a new purchase order.
// The PO number is assigned here, atomically, so it always increases and
// never collides even if two people create a PO at the same instant.
export async function POST(req) {
  const role = await getRole();
  if (!role) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const po = await req.json();
  const n = await kv.incr(COUNTER_KEY);
  po.poNo = `PO-${String(n).padStart(4, "0")}`;
  po.createdAt = po.createdAt || Date.now();
  await kv.set(`po:${po.id}`, po);
  await kv.sadd(INDEX_KEY, po.id);
  return NextResponse.json({ ok: true, list: await loadAll() });
}
