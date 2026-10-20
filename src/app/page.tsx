import { connection } from "next/server";
import { SiteView } from "@/components/site/site-view";
import { getRepository } from "@/lib/repository";

export default async function HomePage() {
  await connection();
  const state = await (await getRepository()).getState();
  return <SiteView content={state.published} />;
}
