/**
 * ตัวช่วยผูกข้อความ validation จาก backend (ApiError.field) เข้ากับช่องกรอกของ MUI TextField
 * MUI ต่อ aria-invalid / aria-describedby ให้เองเมื่อส่ง error + helperText + id
 */
export type FieldError = { field?: string; message: string } | null | undefined;

export function fieldErrorHelpers(fieldError: FieldError, prefix: string) {
  const fid = (field: string) => `${prefix}-${field}`;
  const errMsg = (field: string) => (fieldError && fieldError.field === field ? fieldError.message : undefined);
  /** props มาตรฐานของช่องที่ backend อาจตอบ error กลับมา (help = ข้อความช่วยเหลือเมื่อไม่มี error) */
  const fe = (field: string, help?: string) => ({
    id: fid(field),
    error: !!errMsg(field),
    helperText: errMsg(field) ?? help,
  });
  return { fid, errMsg, fe };
}

/** รายการตัวเลือกที่ยังเก็บค่าปัจจุบันไว้ แม้ค่านั้นถูกลบออกจากข้อมูลหลักไปแล้ว (ไม่ให้ select แสดงช่องว่าง) */
export function withCurrent(list: string[], current: string | undefined | null): string[] {
  return current && !list.includes(current) ? [...list, current] : list;
}
