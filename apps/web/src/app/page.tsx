import { cookies } from "next/headers";
import { CutawayWorkbench } from "@/components/cutaway/workbench";
import { Providers } from "@/components/providers";
import {
  operatorAuth,
  operatorCookieName,
} from "@/lib/server/cutaway/operator-auth";
import "@/components/cutaway/cutaway.css";

export default async function Home() {
  const cookie = (await cookies()).get(operatorCookieName)?.value;
  const operator = await operatorAuth.isOperator(cookie).catch(() => false);
  if (operator)
    return (
      <Providers>
        <CutawayWorkbench />
      </Providers>
    );
  return (
    <main style={{ height: "100dvh", background: "#f8f5ee" }}>
      <iframe
        src="http://127.0.0.1:4120/workshops/pottery-saturday"
        title="Fieldnote Studio"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </main>
  );
}
