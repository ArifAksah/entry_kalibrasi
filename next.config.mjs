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
  serverExternalPackages: ['playwright'],
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
    // Only explicitly public Supabase values may be compiled into browser JS.
    // Generic ANON_KEY/SUPABASE_PUBLIC_URL aliases stay server-side to avoid
    // accidentally bundling a privileged key through an ambiguous variable.
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_PUBLIC_URL ||
      process.env.API_EXTERNAL_URL ||
      'http://localhost:8000',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async headers() {
    // Content-Security-Policy is emitted as Report-Only on purpose: the app
    // relies on Next.js inline bootstrap scripts and styled-components, so an
    // enforcing CSP must be rolled out with nonces and staged testing first.
    const supabaseOrigin = (() => {
      try {
        return new URL(
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
            process.env.SUPABASE_PUBLIC_URL ||
            process.env.API_EXTERNAL_URL ||
            'http://localhost:8000',
        ).origin
      } catch {
        return ''
      }
    })()

    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      supabaseOrigin ? `connect-src 'self' ${supabaseOrigin}` : "connect-src 'self'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // HSTS: only meaningful over HTTPS; harmless on HTTP (ignored).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
        ],
      },
    ]
  },
};

export default nextConfig;
