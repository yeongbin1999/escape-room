import { NextResponse } from 'next/server';
import { deleteR2Object } from '@/lib/r2';

export async function DELETE(request: Request) {
  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'Missing object key' }, { status: 400 });
    }

    await deleteR2Object(key);
    return NextResponse.json({ message: `Object ${key} deleted successfully` });
  } catch (error) {
    console.error('Error deleting R2 object via API:', error);
    return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
  }
}
