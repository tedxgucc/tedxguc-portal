// The site is published as plain files (GitHub Pages). Pages load their
// data in the browser; Supabase's rules protect everything.
/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default nextConfig;
