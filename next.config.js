/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // SEC-02 (UAT 18 พ.ย. 69): กันการฝังหน้าเว็บใน iframe ของเว็บอื่น (clickjacking) · อนุญาตเฉพาะ origin เดียวกัน (พิมพ์/พรีวิวภายในระบบ)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
