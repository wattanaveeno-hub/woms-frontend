import { FEATURES } from "@/lib/features";
import { WomsHiddenFeature } from "@/components/woms/WomsHiddenFeature";

// คิวช่าง (Chat & Queue v1) — เปิดเป็นค่าเริ่มต้น ปิดได้ด้วย NEXT_PUBLIC_FEATURE_SERVICE_QUEUE=0
export default function ServiceQueueLayout({ children }: { children: React.ReactNode }) {
  return <WomsHiddenFeature enabled={FEATURES.serviceQueue}>{children}</WomsHiddenFeature>;
}
