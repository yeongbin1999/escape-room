"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { app } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { RiAdminFill } from "react-icons/ri";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, loading } = useAuth();
  const router = useRouter();
  const auth = getAuth(app);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>('');

  useEffect(() => {
    if (!loading && role !== 'admin') {
      router.push('/');
    }
  }, [role, loading, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentAdminEmail(user.email || '관리자');
      } else {
        // This case is handled by the role check, but as a fallback
        // router.push('/'); // 주석 처리 또는 제거하여 상위 useEffect에 의존
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  if (loading || role !== 'admin') {
    // PlayerLayout과 동일한 로딩 스피너 UI 적용
    return (
      <div className="flex items-center justify-center h-screen bg-[#1f1f1f] text-white">
        <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>로딩중</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <nav className="flex items-center justify-between p-4 bg-black shadow-md">
        <Link href="/admin">
          <h1 className="text-2xl inline font-extrabold tracking-widest cursor-pointer">ESCAPE ROOM</h1>
          <span className="text-sm text-gray-400 ml-2">admin</span>
        </Link>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="rounded-full h-10 w-10 p-0 text-white hover:bg-[#282828] border-gray-700"
            >
              <RiAdminFill className="h-8 w-8" />
              <span className="sr-only">관리자 메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#1f1f1f] text-white border-slate-700/70 mr-4">
            <DropdownMenuLabel className="truncate">{currentAdminEmail}</DropdownMenuLabel> 
            <DropdownMenuSeparator className="bg-slate-700/70" />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="cursor-pointer text-red-400 hover:bg-slate-700/70"
            >
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <main>{children}</main>
    </div>
  );
}