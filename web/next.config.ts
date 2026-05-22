import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Bundle the evaluation methodology (modes/*.md) into the evaluate functions so
  // they can be read from the filesystem at runtime — no GitHub token dependency.
  outputFileTracingIncludes: {
    '/api/ai/evaluate': ['./modes/**'],
    '/api/ai/evaluate-batch': ['./modes/**'],
  },
};

export default nextConfig;
