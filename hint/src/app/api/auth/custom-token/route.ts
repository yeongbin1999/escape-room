// src/app/api/auth/custom-token/route.ts
import { NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const SERVER_PLAYER_EMAIL = process.env.SERVER_PLAYER_EMAIL;

    if (!SERVER_PLAYER_EMAIL) {
      console.error('SERVER_PLAYER_EMAIL environment variable is not set.');
      return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
    }

    // Use the player's email as the UID for Firebase Authentication
    const uid = SERVER_PLAYER_EMAIL;

    // Generate a custom token
    const customToken = await firebaseAdmin.auth().createCustomToken(uid);

    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error('Error generating custom token:', error);
    return NextResponse.json({ message: 'Failed to generate custom token', error: error.message }, { status: 500 });
  }
}
