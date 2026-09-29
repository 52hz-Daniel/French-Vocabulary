import LearnSession from "@/components/LearnSession";

export default async function LearnPage({ params, searchParams }: { params: Promise<{ collectionId: string }>; searchParams: Promise<{ item?: string }> }) {
  const [{ collectionId }, { item }] = await Promise.all([params, searchParams]);
  return <LearnSession collectionId={collectionId} requestedId={item} />;
}
