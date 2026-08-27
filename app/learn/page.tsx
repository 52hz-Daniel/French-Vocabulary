import { redirect } from "next/navigation";
import { loadDataset } from "@/data/load-dataset";

export const dynamic = "force-dynamic";

export default async function LearnIndexPage() {
  const data = await loadDataset();
  const collection = data.collections.find((item) => item.available);
  redirect(collection ? `/learn/${collection.id}` : "/debug");
}
