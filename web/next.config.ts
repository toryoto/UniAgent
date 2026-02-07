import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  
  serverExternalPackages: ['@react-native-async-storage/async-storage'],
};

export default nextConfig;