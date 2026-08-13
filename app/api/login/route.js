import { NextResponse } from "next/server";
import { checkCredentials, signSession } from "../../../lib/auth";

export async function POST(req) {
  const { username, password } = await req.json();
  const role = checkCredentials((username || "").trim(), password || "");
  if (!role) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }
  const token = await signSession(role);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set("kcs_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
