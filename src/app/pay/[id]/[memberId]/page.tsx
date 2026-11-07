import { PayShare } from "@/components/PayShare";

export default async function PayPage({ params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  return <PayShare kittyId={id} memberId={memberId} />;
}
