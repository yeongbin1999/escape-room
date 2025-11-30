// src/app/api/auth/custom-token/route.ts
import { NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const SERVER_PLAYER_EMAIL = process.env.SERVER_PLAYER_EMAIL;

    if (!SERVER_PLAYER_EMAIL) {
      console.error('SERVER_PLAYER_EMAIL environment variable is not set.');
      return NextResponse.json({ message: 'Server configuration error: SERVER_PLAYER_EMAIL missing' }, { status: 500 });
    }

    let uidToUse: string;

    try {
      // Get the user by email, assuming it always exists
      const userRecord = await firebaseAdmin.auth().getUserByEmail(SERVER_PLAYER_EMAIL);
      uidToUse = userRecord.uid;
    } catch (error: any) {
      console.error('Error fetching Firebase user (user is assumed to exist):', error);
      return NextResponse.json({ message: 'Failed to retrieve predefined Firebase user', error: error.message }, { status: 500 });
    }

    // Use the determined UID to generate a custom token
    const customToken = await firebaseAdmin.auth().createCustomToken(uidToUse);

    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error('Error generating custom token:', error);
    return NextResponse.json({ message: 'Failed to generate custom token', error: error.message }, { status: 500 });
  }
}
