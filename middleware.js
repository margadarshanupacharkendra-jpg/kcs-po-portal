import { NextResponse } from "next/server";
import { verifySession } from "./lib/auth";

export const config = {
  matcher: ["/((?!api/login|_next/static|_next/image|favicon.ico|login).*)"],
};

export async function middleware(req) {
  const cookie = req.cookies.get("kcs_session")?.value;
  const role = await verifySession(cookie);

  if (!role) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
