import { PayShare } from "@/components/PayShare";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayShare kittyId={id} />;
}
