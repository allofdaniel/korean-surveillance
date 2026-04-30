/**
 * Vercel Serverless Function - Health Check
 * Production readiness endpoint (Production P2-4)
 */
import { setCorsHeaders } from './_utils/cors.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev',
    region: process.env.VERCEL_REGION || 'unknown'
  });
}
