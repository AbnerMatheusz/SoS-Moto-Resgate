import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok.io", "*.ngrok-free.app"],
};

export default nextConfig;
