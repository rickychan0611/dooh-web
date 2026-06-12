import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dooh/shared"],
  async headers() {
    const corsHeaders = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, POST, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Authorization, Content-Type",
      },
      { key: "Access-Control-Max-Age", value: "86400" },
    ];

    return [
      {
        source: "/api/player/:path*",
        headers: corsHeaders,
      },
      {
        source: "/api/public/:path*",
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;
