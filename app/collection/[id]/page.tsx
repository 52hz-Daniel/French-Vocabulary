import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDataset } from "@/data/load-dataset";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadDataset();
  const collection = data.collections.find((item) => item.id === id);
  if (!collection) notFound();
  const count = data.lexemes.filter((item) => item.collectionIds.includes(id)).length;
  return <section className="page-shell narrow">
    <Link className="back" href="/library">← Library</Link><div className="eyebrow">Current collection</div><h1>{collection.name}</h1><p className="lead">{collection.description}</p>
    <div className="study-summary"><div><span>Ready to learn</span><strong>{count}</strong></div><div><span>Reviews due</span><strong>0</strong></div><div><span>Progress</span><strong>0%</strong></div></div>
    <Link className="primary-button" href={`/learn/${id}`}>Start learning <span>→</span></Link>
  </section>;
}
