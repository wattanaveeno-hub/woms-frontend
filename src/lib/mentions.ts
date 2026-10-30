// CHAT-02 v2 — แท็กผู้ใช้ในแชทกลุ่ม (ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test)
// ผู้ถูกแท็กอ้างอิงด้วย User ID ที่เลือกจากรายชื่อสมาชิก ไม่ใช่การจับคู่ชื่อจากข้อความ
export type MentionMember = { id: string; name: string; role: string };

/** คำหลัง "@" ท้ายข้อความ (null = ไม่ได้กำลังพิมพ์แท็ก) */
export function mentionQueryOf(text: string): string | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? m[2] : null;
}

/** รายชื่อที่แท็กได้ (ไม่รวมตัวเอง) ตามคำที่พิมพ์ */
export function mentionOptions(members: MentionMember[], query: string | null, selfId: string | undefined, limit = 8): MentionMember[] {
  if (query === null) return [];
  const q = query.toLowerCase();
  return members.filter((m) => m.id !== selfId && m.name.toLowerCase().includes(q)).slice(0, limit);
}

/** แทนคำ "@xxx" ท้ายข้อความด้วยชื่อเต็มของผู้ที่เลือก */
export function applyMention(text: string, name: string): string {
  return text.replace(/@([^\s@]*)$/, `@${name} `);
}

/** User ID ที่จะส่ง — เฉพาะผู้ที่ถูกเลือก และยังมี "@ชื่อ" อยู่ในข้อความตอนส่ง */
export function mentionsToSend(selectedIds: string[], members: MentionMember[], body: string): string[] {
  return [...new Set(selectedIds)].filter((id) => {
    const m = members.find((x) => x.id === id);
    return !!m && body.includes(`@${m.name}`);
  });
}
