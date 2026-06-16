// Convert a number to Thai baht text (e.g. 1234.50 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์").

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// Read an integer string (no sign) into Thai words.
// partOfLarger = true when this group follows a higher-order group (e.g. after "ล้าน"),
// so a lone trailing 1 is read as "เอ็ด" rather than "หนึ่ง".
function readInteger(input: string, partOfLarger = false): string {
  let n = input.replace(/^0+/, "");
  if (n === "") return "";

  // groups of 6 digits joined by "ล้าน"
  if (n.length > 6) {
    const head = n.slice(0, n.length - 6);
    const tail = n.slice(n.length - 6);
    const tailWords = tail === "000000" ? "" : readInteger(tail, true);
    return readInteger(head, false) + "ล้าน" + tailWords;
  }

  let out = "";
  const len = n.length;
  for (let i = 0; i < len; i++) {
    const d = Number(n[i]);
    const pos = len - i - 1; // 0 = units place
    if (d === 0) continue;
    if (pos === 0 && d === 1 && (len > 1 || partOfLarger)) {
      out += "เอ็ด";
    } else if (pos === 1 && d === 2) {
      out += "ยี่" + UNITS[pos];
    } else if (pos === 1 && d === 1) {
      out += UNITS[pos]; // "สิบ" (no leading หนึ่ง)
    } else {
      out += DIGITS[d] + UNITS[pos];
    }
  }
  return out;
}

export function bahtText(amount: number): string {
  const value = Math.round((amount + Number.EPSILON) * 100) / 100;
  const [bahtPart, satangPart] = value.toFixed(2).split(".");
  const baht = readInteger(bahtPart);
  let text = baht ? `${baht}บาท` : "ศูนย์บาท";
  if (satangPart === "00") {
    text += "ถ้วน";
  } else {
    text += `${readInteger(satangPart)}สตางค์`;
  }
  return text;
}
