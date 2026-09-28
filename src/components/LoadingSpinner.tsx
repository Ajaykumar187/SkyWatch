export default function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
