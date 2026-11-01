/**
 * FE-02 (O-01): ตรวจสิทธิ์ก่อนเรียก API ที่หน้าเว็บเรียกเองตอนโหลด/poll
 *
 * เดิม Dashboard / Notifications / NotificationBell เรียกทุก endpoint แล้วกลืน 403 ด้วย safe()
 * → backend บันทึก ACCESS_DENIED ทุกครั้ง (acc ≈ 5 แถว/นาที ต่อแท็บที่เปิดค้าง)
 * ไฟล์นี้ mirror guard ของ backend เท่านั้น — ไม่ได้กำหนดสิทธิ์ใหม่ backend ยังตรวจสิทธิ์ทุกคำขอเหมือนเดิม
 * `has` มาจาก permissions ของ /api/auth/me (AuthContext) จึงตรงกับ ROLE_PERMISSIONS ของ backend
 *
 * ห้าม import React / alias "@/" ในไฟล์นี้ (เทสต์รันด้วย node --test ตรง ๆ)
 */

export type Has = (perm: string) => boolean;

/** GET /api/jobs · /api/dashboard/jobs · /api/notifications(/unread-count) · /api/chat/unread/summary · /api/submissions → jobs:view */
export const canViewJobs = (has: Has): boolean => has("jobs:view");

/** GET /api/contracts → contracts:view (backend routes/contracts.ts) */
export const canViewContracts = (has: Has): boolean => has("contracts:view");

/** GET /api/quotations → quotations:view (backend routes/quotations.ts) */
export const canViewQuotations = (has: Has): boolean => has("quotations:view");

/** GET /api/documents → documents:view (backend routes/documents.ts) */
export const canViewDocuments = (has: Has): boolean => has("documents:view");

/** GET /api/queue/bookings → queue:view (backend routes/queue.ts) */
export const canViewBookings = (has: Has): boolean => has("queue:view");

/**
 * GET /api/equipment/summary → inventory:view และต้องไม่ถูกจำกัดข้อมูล
 * (backend routes/equipment.ts BUG-V2-17 + lib/dataScope.ts isDataRestricted = ไม่มี jobs:view_all)
 * ช่างมี inventory:view แต่ไม่มี jobs:view_all → ได้ 403
 */
export const canViewCompanyInventorySummary = (has: Has): boolean => has("inventory:view") && has("jobs:view_all");

/** กระดิ่งแจ้งเตือนระบบ (D-FE-01 A): ซ่อนเมื่อไม่มี jobs:view — ทั้ง unread-count และหน้ารายการต้องใช้ jobs:view */
export const showNotificationBell = (has: Has): boolean => canViewJobs(has);

export interface DashboardFetchPlan {
  equipmentSummary: boolean;
  contracts: boolean;
  jobs: boolean;
  quotations: boolean;
  bookings: boolean;
  documents: boolean;
  equipmentDashboard: boolean;
  jobDashboard: boolean;
}

/** หน้า Dashboard: endpoint ไหนเรียกได้ (techQueue = FEATURES.techQueue) */
export function dashboardFetchPlan(has: Has, features: { techQueue: boolean }): DashboardFetchPlan {
  return {
    equipmentSummary: canViewCompanyInventorySummary(has),
    contracts: canViewContracts(has),
    jobs: canViewJobs(has),
    quotations: canViewQuotations(has),
    bookings: features.techQueue && canViewBookings(has),
    documents: canViewDocuments(has),
    equipmentDashboard: has("equipment:view"),
    jobDashboard: canViewJobs(has),
  };
}

export interface NotificationsFetchPlan {
  jobDashboard: boolean;
  overdueJobs: boolean;
  openJobs: boolean;
  contracts: boolean;
  equipmentSummary: boolean;
  submissions: boolean;
  unreadChats: boolean;
}

/** แผงงานค้าง (<Notifications />): endpoint ไหนเรียกได้ (chat = chatNotificationsEnabled(FEATURES)) */
export function notificationsFetchPlan(has: Has, features: { chat: boolean }): NotificationsFetchPlan {
  const jobs = canViewJobs(has);
  return {
    jobDashboard: jobs,
    overdueJobs: jobs,
    openJobs: jobs,
    contracts: canViewContracts(has),
    equipmentSummary: canViewCompanyInventorySummary(has),
    submissions: features.chat && jobs,
    unreadChats: features.chat && jobs,
  };
}

/** มีอย่างน้อย 1 endpoint ให้เรียก — ถ้าไม่มีเลย ไม่ต้องตั้ง interval poll */
export function anyFetch(plan: object): boolean {
  return Object.values(plan).some(Boolean);
}
