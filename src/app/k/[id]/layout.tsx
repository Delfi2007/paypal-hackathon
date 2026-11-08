import { KittyShell } from "@/components/KittyShell";

export default async function KittyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KittyShell id={id}>{children}</KittyShell>;
}
