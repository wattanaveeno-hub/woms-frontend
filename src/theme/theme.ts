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
    h1: { fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: "1.3rem", fontWeight: 700, lineHeight: 1.35 },
    h3: { fontSize: "1.1rem", fontWeight: 700 },
    h4: { fontSize: "1rem", fontWeight: 700 },
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
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, borderRadius: t.radius },
        sizeLarge: { minHeight: 48, fontSize: "1rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 40, minHeight: 40 } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { outlined: { borderColor: t.line } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, backgroundColor: t.surface2, color: t.slate },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: t.radius } },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: "sm" },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
