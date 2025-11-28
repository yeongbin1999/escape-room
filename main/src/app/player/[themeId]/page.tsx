"use client"
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function PlayerGamePage() {
  const params = useParams();
  const { themeId } = params;

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Player Game Page</h1>
      <p>Welcome to theme: <span className="font-semibold text-blue-400">{themeId}</span></p>
      <Link href="/player" className="text-blue-500 hover:underline mt-4 inline-block">
        &larr; Back to Theme Selection
      </Link>
    </div>
  );
}
