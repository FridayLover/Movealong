/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["picsum.photos", "images.unsplash.com", "via.placeholder.com"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
