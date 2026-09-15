// ส่งต่อ "เครื่องที่เลือกจากหน้าคลัง" ไปยังหน้าเปิดงาน
//
// เก็บเฉพาะ id ไว้ใน sessionStorage — ไม่ยัด JSON ของเครื่องลง URL
// เพราะข้อมูลจริงต้องมาจาก backend เสมอ (หน้าเปิดงานจะ fetch ใหม่ทุกครั้ง)
// sessionStorage เหมาะกว่า query string ตรงที่ URL สั้น แชร์ลิงก์แล้วไม่พาข้อมูลค้างไปด้วย
// และอยู่แค่แท็บเดียว หมดอายุเมื่อปิดแท็บ

const KEY = "woms_job_prefill";

export interface JobPrefill {
  equipmentIds: string[];
  jobType: string;
}

export function setJobPrefill(data: JobPrefill): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* โหมดส่วนตัว/บล็อก storage — หน้าเปิดงานจะทำงานแบบไม่มี prefill ตามปกติ */
  }
}

/** อ่านแล้วล้างทิ้งทันที — กัน prefill ค้างไปโผล่ในการเปิดงานครั้งถัดไป */
export function takeJobPrefill(): JobPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as JobPrefill;
    const ids = Array.isArray(parsed?.equipmentIds)
      ? parsed.equipmentIds.filter((x) => typeof x === "string" && x)
      : [];
    if (!ids.length) return null;
    return { equipmentIds: ids, jobType: typeof parsed.jobType === "string" ? parsed.jobType : "" };
  } catch {
    return null;
  }
}
