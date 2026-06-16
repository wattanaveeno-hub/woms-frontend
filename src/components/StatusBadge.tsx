import type { JobStatus } from "@/lib/types";
import { statusLabel } from "@/lib/options";

export default function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`badge ${status === "OPEN" ? "badge-open" : "badge-closed"}`}>
      {statusLabel[status]}
    </span>
  );
}
