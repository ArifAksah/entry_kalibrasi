import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Explicitly set the tracing root to this app directory to avoid monorepo lockfile warnings
  outputFileTracingRoot: __dirname,
  // Externalize playwright for server components and API routes
  serverComponentsExternalPackages: ['playwright'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize playwright for server-side rendering
      config.externals = config.externals || []
      config.externals.push({
        playwright: 'commonjs playwright',
      })
    }
    return config
  },
  env: {
    // Expose VM-style envs to the client for browser fallback support
    SUPABASE_PUBLIC_URL: process.env.SUPABASE_PUBLIC_URL,
    API_EXTERNAL_URL: process.env.API_EXTERNAL_URL,
    ANON_KEY: process.env.ANON_KEY,
    // Ensure client receives NEXT_PUBLIC_* values derived from VM envs
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_PUBLIC_URL ||
      process.env.API_EXTERNAL_URL ||
      'http://localhost:7000',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.ANON_KEY,
    // Map service role key name used by server routes
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SERVICE_ROLE_KEY,
  },
};

export default nextConfig;