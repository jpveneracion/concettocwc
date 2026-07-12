import { NextResponse } from 'next/server';

export async function GET() {
  const debugInfo = {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      piClientId: process.env.NEXT_PUBLIC_PI_CLIENT_ID ? '✅ Set' : '❌ Missing',
    },
    nextAuth: {
      googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      googleClientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    }
  };

  return NextResponse.json(debugInfo);
}