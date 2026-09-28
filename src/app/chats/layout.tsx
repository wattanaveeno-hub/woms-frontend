import { FEATURES } from "@/lib/features";
import { WomsHiddenFeature } from "@/components/woms/WomsHiddenFeature";

// HIDE-01 — ซ่อนทั้งเมนูและการเข้าผ่าน URL ตรง จนกว่าจะเปิด flag
export default function HiddenLayout({ children }: { children: React.ReactNode }) {
  return <WomsHiddenFeature enabled={FEATURES.chat}>{children}</WomsHiddenFeature>;
}
