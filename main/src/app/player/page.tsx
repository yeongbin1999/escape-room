import Link from "next/link";

export default function Player() {
  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      {/* Top Navigation Bar (simplified for now, can be a shared component later) */}
      <nav className="flex items-center justify-between p-4 bg-black shadow-md">
        <Link href="/player">
          <h1 className="text-2xl font-extrabold tracking-widest cursor-pointer">ESCAPE ROOM</h1>
        </Link>
        {/* User info and logout can be added here if not using a shared layout */}
      </nav>

      <main className="p-8">
        <h1>player</h1>
      </main>
    </div>
  );
}