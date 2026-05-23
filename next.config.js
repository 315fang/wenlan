/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
}
nextConfig.outputFileTracingRoot = process.cwd()

module.exports = nextConfig
