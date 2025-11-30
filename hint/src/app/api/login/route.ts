import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const PLAYER_USERNAME = process.env.PLAYER_USERNAME;
  const PLAYER_PASSWORD = process.env.PLAYER_PASSWORD;

  if (!PLAYER_USERNAME || !PLAYER_PASSWORD) {
    console.error('Environment variables PLAYER_USERNAME or PLAYER_PASSWORD are not set.');
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }

  if (username === PLAYER_USERNAME && password === PLAYER_PASSWORD) {
    // In a real application, you would generate a JWT token or set a session cookie here.
    return NextResponse.json({ message: 'Login successful', user: { username: PLAYER_USERNAME } });
  } else {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}
