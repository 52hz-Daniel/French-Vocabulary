import LearnSession from "@/components/LearnSession";

export default async function LearnPage({ params }: { params: Promise<{ collectionId: string }> }) {
  return <LearnSession collectionId={(await params).collectionId} />;
}
