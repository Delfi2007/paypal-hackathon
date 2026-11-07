import { Dashboard } from "@/components/Dashboard";

export default async function KittyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Dashboard id={id} />;
}
