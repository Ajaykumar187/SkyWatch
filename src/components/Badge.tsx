export default function Badge({
  children,
  kind = "info",
}: {
  children: React.ReactNode;
  kind?: "info" | "success" | "warning" | "danger";
}) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}
