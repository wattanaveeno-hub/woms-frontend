"use client";

import { useRouter } from "next/navigation";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";

const KINDS: { kind: MasterKind; desc: string }[] = [
  { kind: "team", desc: "จัดการรายชื่อทีมช่างที่ใช้ในการเปิดงาน" },
  { kind: "model", desc: "จัดการรายชื่อรุ่นเครื่องที่ใช้ในการเปิดงาน" },
];

export default function MasterHubPage() {
  const router = useRouter();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ข้อมูลพื้นฐาน</h1>
          <div className="sub">จัดการรายการที่ใช้เป็นตัวเลือกในฟอร์มเปิดงาน</div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map(({ kind, desc }) => (
              <tr
                key={kind}
                className="row-link"
                onClick={() => router.push(`/master/${kind}`)}
              >
                <td className="code">{masterLabel[kind]}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
