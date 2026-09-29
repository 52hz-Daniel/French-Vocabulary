import { redirect } from "next/navigation";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/learn/${(await params).id}`);
}
