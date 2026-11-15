"use client";

// ---------------------------------------------------------------------------
// WOMS MUI theme — ทุกหน้าที่ใช้ MUI ต้องอ่านสี/ตัวอักษร/ขนาดจากที่นี่ ห้าม hard-code ซ้ำ
// ---------------------------------------------------------------------------
import { createTheme } from "@mui/material/styles";
import { tokens as t } from "./tokens";

declare module "@mui/material/styles" {
  interface Palette {
    neutral: Palette["primary"];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions["primary"];
  }
}
declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    neutral: true;
  }
}
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: t.accent, dark: t.accentInk, light: t.accentBg, contrastText: "#ffffff" },
    secondary: { main: t.slate, contrastText: "#ffffff" },
    // สถานะ: success = ปิดงาน/ปกติ · warning = เปิดงาน/ใกล้ถึง · error = เกิน/อันตราย
    success: { main: t.closed, light: t.closedBg, contrastText: "#ffffff" },
    warning: { main: t.open, light: t.openBg, contrastText: "#ffffff" },
    error: { main: t.danger, light: t.dangerBg, contrastText: "#ffffff" },
    info: { main: t.info, light: t.infoBg, contrastText: "#ffffff" },
    neutral: { main: t.slate2, light: t.chip, dark: t.slate, contrastText: "#ffffff" },
    background: { default: t.paper, paper: t.surface },
    text: { primary: t.ink, secondary: t.slate2 },
    divider: t.line,
  },
  shape: { borderRadius: t.radius },
  spacing: 8,
  typography: {
    fontFamily: t.sans,
    fontSize: 15,
    // ENTECH DS: h1 26 · h2 18 · h3 15
    h1: { fontSize: "1.625rem", fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.4 },
    h3: { fontSize: "1rem", fontWeight: 700, lineHeight: 1.4 },
    h4: { fontSize: "0.9375rem", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
    body2: { color: t.slate2 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: "antialiased" },
        a: { color: t.accentInk },
      },
    },
    // ---- ENTECH design system (ปุ่ม/การ์ด/ตาราง/แท็บ/ชิป ให้ตรง DS ทุกหน้าโดยไม่แตะ logic ของหน้า) ----
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 36, borderRadius: t.radius, padding: "6px 16px", fontSize: 14, lineHeight: 1.4 },
        sizeSmall: { minHeight: 32, padding: "4px 12px", fontSize: 13 },
        sizeLarge: { minHeight: 48, fontSize: "1rem", padding: "8px 24px" },
        // ปุ่มรอง (.btn) = พื้นขาว ขอบ line-strong ตัวอักษร ink · ปุ่มสีอื่น (error ฯลฯ) คงสีของตัวเอง
        outlinedPrimary: {
          borderColor: t.lineStrong,
          color: t.ink,
          backgroundColor: t.surface,
          "&:hover": { backgroundColor: "#f0f3f6", borderColor: t.lineStrong },
        },
        outlinedError: { borderColor: "#e6c4c1", "&:hover": { backgroundColor: t.dangerBg } },
        textPrimary: { color: t.accentInk },
        containedPrimary: { "&:hover": { backgroundColor: t.accentInk } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 40, minHeight: 40, borderRadius: t.radius } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: t.radius,
          backgroundColor: t.surface,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: t.lineStrong },
          "&.Mui-disabled": { backgroundColor: t.chip },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderStyle: "dashed" },
        },
      },
    },
    MuiFormLabel: { styleOverrides: { root: { color: t.slate } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, fontSize: 12, lineHeight: "16px" } } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        outlined: { borderColor: t.lineStrong, borderRadius: 12, boxShadow: "0 1px 2px rgba(22,32,43,.06), 0 1px 1px rgba(22,32,43,.04)" },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiCardHeader: {
      styleOverrides: { title: { fontSize: 18, fontWeight: 700 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999, fontSize: 12 },
        sizeSmall: { height: 24 },
      },
    },
    MuiTableContainer: { styleOverrides: { root: { overflowX: "auto" } } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: "12px 16px", fontSize: 14, borderBottom: `1px solid ${t.line}` },
        head: {
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1.4,
          color: t.slate2,
          backgroundColor: t.surface2,
          borderBottom: `1px solid ${t.lineStrong}`,
          whiteSpace: "nowrap",
        },
        sizeSmall: { padding: "12px 16px" },
        paddingCheckbox: { padding: "0 0 0 8px" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover > td": { backgroundColor: "#f8fafb" },
          "&:last-child > td.MuiTableCell-body": { borderBottom: 0 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: `1px solid ${t.lineStrong}` },
        indicator: { height: 2, backgroundColor: t.accent },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: "0 16px",
          fontSize: 14,
          fontWeight: 600,
          textTransform: "none",
          color: t.slate2,
          "&:hover": { color: t.ink },
          "&.Mui-selected": { color: t.accentInk },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 36,
          padding: "0 16px",
          fontSize: 14,
          fontWeight: 600,
          textTransform: "none",
          color: t.slate,
          borderColor: t.lineStrong,
          "&.Mui-selected": { backgroundColor: t.accentBg, color: t.accentInk },
          "&.Mui-selected:hover": { backgroundColor: t.accentBg },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: t.radius, fontSize: 14, alignItems: "center" },
        standardWarning: { backgroundColor: t.openBg, border: "1px solid #ecd6a8", color: "#8a5606" },
        standardInfo: { backgroundColor: t.infoBg, border: "1px solid #bcd6e8", color: t.ink },
        standardSuccess: { backgroundColor: t.closedBg, border: "1px solid #cfe0cd", color: "#3d6340" },
        standardError: { backgroundColor: t.dangerBg, border: "1px solid #e6c4c1", color: t.danger },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: t.line } } },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: "sm" },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
