import { cookies } from "next/headers";
import { verifySession } from "../lib/auth";
import PoApp from "../components/PoApp";

export default async function Page() {
  const role = await verifySession(cookies().get("kcs_session")?.value);
  return <PoApp role={role || "user"} />;
}
