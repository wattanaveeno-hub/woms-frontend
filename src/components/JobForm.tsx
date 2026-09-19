"use client";

import { useState } from "react";
import type { JobFormValues, Options } from "@/lib/types";

const EMPTY: JobFormValues = {
  jobType: "INSTALL",
  jobSubType: "",
  jobName: "",
  technicianTeam: "",
  salesPerson: "",
  model: "",
  filterUnit: "",
  contactName: "",
  phone: "",
  jobDate: "",
  jobTime: "",
  mapLink: "",
  note: "",
};

export interface JobFormProps {
  options: Options;
  initial?: Partial<JobFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: JobFormValues) => void;
  /** optional extra controls rendered next to the submit button (e.g. Close job) */
  extraActions?: React.ReactNode;
  /**
   * true = ใบงานนี้มีเครื่องผูกอยู่แล้ว (หรือกำลังจะผูกตอนบันทึก)
   * → ช่อง "เครื่องกรอง" (filterUnit) เป็นค่าที่ backend ตั้งให้เอง หน้าเว็บจึงแค่แสดง ไม่ให้แก้
   *   เพื่อไม่ให้มีกติกาความเข้ากันได้สองชุด
   */
  equipmentLinked?: boolean;
}

export default function JobForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
  equipmentLinked,
}: JobFormProps) {
  const [v, setV] = useState<JobFormValues>({ ...EMPTY, ...initial });

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // ---- accessibility: ผูก label ↔ ช่องกรอก และผูกข้อความ validation เข้ากับช่องนั้น ----
  const fid = (field: string) => `job-${field}`;
  const errId = (field: string) => `${fid(field)}-error`;

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error" id={errId(field)} role="alert">
        {fieldError.message}
      </span>
    ) : null;

  const aria = (field: string) =>
    fieldError && fieldError.field === field
      ? { "aria-invalid": true as const, "aria-describedby": errId(field) }
      : {};

  const submit = () => {
    const cleaned: JobFormValues = {
      ...v,
      jobSubType: v.jobType === "REMOVE" ? v.jobSubType : "",
    };
    onSubmit(cleaned);
  };

  const isRemove = v.jobType === "REMOVE";

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error">{fieldError.message}</div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor={fid("jobType")}>
            ประเภทงาน<span className="req">*</span>
          </label>
          <select
            id={fid("jobType")}
            {...aria("jobType")}
            className="select"
            value={v.jobType}
            onChange={(e) => set("jobType", e.target.value as JobFormValues["jobType"])}
          >
            {options.jobTypes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errFor("jobType")}
        </div>

        {isRemove ? (
          <div className="field">
            <label htmlFor={fid("jobSubType")}>
              ประเภทย่อย (ซ่อมถอน)<span className="req">*</span>
            </label>
            <select
              id={fid("jobSubType")}
              {...aria("jobSubType")}
              className="select"
              value={v.jobSubType}
              onChange={(e) =>
                set("jobSubType", e.target.value as JobFormValues["jobSubType"])
              }
            >
              <option value="">— เลือก —</option>
              {options.jobSubTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errFor("jobSubType")}
          </div>
        ) : (
          <div className="field" aria-hidden />
        )}

        <div className="field col-span">
          <label htmlFor={fid("jobName")}>
            ชื่องาน<span className="req">*</span>
          </label>
          <input
            id={fid("jobName")}
            {...aria("jobName")}
            className="input"
            value={v.jobName}
            onChange={(e) => set("jobName", e.target.value)}
            placeholder="เช่น ติดตั้งเครื่องกรองน้ำ ลูกค้า..."
          />
          {errFor("jobName")}
        </div>

        <div className="field">
          <label htmlFor={fid("technicianTeam")}>
            ทีมช่าง<span className="req">*</span>
          </label>
          {options.teams.length ? (
            <select
              id={fid("technicianTeam")}
              {...aria("technicianTeam")}
              className="select"
              value={v.technicianTeam}
              onChange={(e) => set("technicianTeam", e.target.value)}
            >
              <option value="">— เลือกทีม —</option>
              {options.teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={fid("technicianTeam")}
              {...aria("technicianTeam")}
              className="input"
              value={v.technicianTeam}
              onChange={(e) => set("technicianTeam", e.target.value)}
              placeholder="ชื่อทีมช่าง"
            />
          )}
          {errFor("technicianTeam")}
        </div>

        <div className="field">
          <label htmlFor={fid("salesPerson")}>เซลล์</label>
          <input
            id={fid("salesPerson")}
            className="input"
            value={v.salesPerson}
            onChange={(e) => set("salesPerson", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={fid("model")}>รุ่น</label>
          {options.models.length ? (
            <input
              id={fid("model")}
              className="input"
              list="model-options"
              value={v.model}
              onChange={(e) => set("model", e.target.value)}
            />
          ) : (
            <input
              id={fid("model")}
              className="input"
              value={v.model}
              onChange={(e) => set("model", e.target.value)}
            />
          )}
          <datalist id="model-options">
            {options.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor={fid("filterUnit")}>เครื่องกรอง</label>
          <input
            id={fid("filterUnit")}
            className="input"
            value={v.filterUnit}
            onChange={(e) => set("filterUnit", e.target.value)}
            placeholder="รุ่น / serial"
            disabled={equipmentLinked}
          />
          {equipmentLinked ? (
            <span className="sub">ระบบตั้งให้ตามเครื่องตัวแรกในใบงานโดยอัตโนมัติ</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={fid("contactName")}>ติดต่อ</label>
          <input
            id={fid("contactName")}
            className="input"
            value={v.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={fid("phone")}>เบอร์</label>
          <input
            id={fid("phone")}
            {...aria("phone")}
            className="input"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            inputMode="tel"
          />
          {errFor("phone")}
        </div>

        <div className="field">
          <label htmlFor={fid("jobDate")}>
            วันที่<span className="req">*</span>
          </label>
          <input
            id={fid("jobDate")}
            {...aria("jobDate")}
            className="input"
            type="date"
            value={v.jobDate}
            onChange={(e) => set("jobDate", e.target.value)}
          />
          {errFor("jobDate")}
        </div>

        <div className="field">
          <label htmlFor={fid("jobTime")}>เวลา</label>
          <input
            id={fid("jobTime")}
            {...aria("jobTime")}
            className="input"
            type="time"
            value={v.jobTime}
            onChange={(e) => set("jobTime", e.target.value)}
          />
          {errFor("jobTime")}
        </div>

        <div className="field col-span">
          <label htmlFor={fid("mapLink")}>Map</label>
          <input
            id={fid("mapLink")}
            {...aria("mapLink")}
            className="input"
            value={v.mapLink}
            onChange={(e) => set("mapLink", e.target.value)}
            placeholder="https://maps.google.com/..."
          />
          {errFor("mapLink")}
        </div>

        <div className="field col-span">
          <label htmlFor={fid("note")}>หมายเหตุ</label>
          <textarea
            id={fid("note")}
            className="textarea"
            value={v.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}
