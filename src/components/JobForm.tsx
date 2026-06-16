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
}

export default function JobForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
}: JobFormProps) {
  const [v, setV] = useState<JobFormValues>({ ...EMPTY, ...initial });

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error">{fieldError.message}</span>
    ) : null;

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
          <label>
            ประเภทงาน<span className="req">*</span>
          </label>
          <select
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
            <label>
              ประเภทย่อย (ซ่อมถอน)<span className="req">*</span>
            </label>
            <select
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
          <label>
            ชื่องาน<span className="req">*</span>
          </label>
          <input
            className="input"
            value={v.jobName}
            onChange={(e) => set("jobName", e.target.value)}
            placeholder="เช่น ติดตั้งเครื่องกรองน้ำ ลูกค้า..."
          />
          {errFor("jobName")}
        </div>

        <div className="field">
          <label>
            ทีมช่าง<span className="req">*</span>
          </label>
          {options.teams.length ? (
            <select
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
              className="input"
              value={v.technicianTeam}
              onChange={(e) => set("technicianTeam", e.target.value)}
              placeholder="ชื่อทีมช่าง"
            />
          )}
          {errFor("technicianTeam")}
        </div>

        <div className="field">
          <label>เซลล์</label>
          <input
            className="input"
            value={v.salesPerson}
            onChange={(e) => set("salesPerson", e.target.value)}
          />
        </div>

        <div className="field">
          <label>รุ่น</label>
          {options.models.length ? (
            <input
              className="input"
              list="model-options"
              value={v.model}
              onChange={(e) => set("model", e.target.value)}
            />
          ) : (
            <input
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
          <label>เครื่องกรอง</label>
          <input
            className="input"
            value={v.filterUnit}
            onChange={(e) => set("filterUnit", e.target.value)}
            placeholder="รุ่น / serial"
          />
        </div>

        <div className="field">
          <label>ติดต่อ</label>
          <input
            className="input"
            value={v.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </div>

        <div className="field">
          <label>เบอร์</label>
          <input
            className="input"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            inputMode="tel"
          />
          {errFor("phone")}
        </div>

        <div className="field">
          <label>
            วันที่<span className="req">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={v.jobDate}
            onChange={(e) => set("jobDate", e.target.value)}
          />
          {errFor("jobDate")}
        </div>

        <div className="field">
          <label>เวลา</label>
          <input
            className="input"
            type="time"
            value={v.jobTime}
            onChange={(e) => set("jobTime", e.target.value)}
          />
          {errFor("jobTime")}
        </div>

        <div className="field col-span">
          <label>Map</label>
          <input
            className="input"
            value={v.mapLink}
            onChange={(e) => set("mapLink", e.target.value)}
            placeholder="https://maps.google.com/..."
          />
          {errFor("mapLink")}
        </div>

        <div className="field col-span">
          <label>หมายเหตุ</label>
          <textarea
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
