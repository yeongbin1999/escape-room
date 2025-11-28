"use client"
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/firebaseConfig"; 
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { RiAdminFill } from "react-icons/ri";


export default function PlayerPage() {
  const router = useRouter(); 
  const [currentPlayerEmail, setCurrentPlayerEmail] = useState<string>('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentPlayerEmail(user.email || '사용자');
      } else {
        setCurrentPlayerEmail('');
        // 필요하다면 여기서 로그인 페이지로 리디렉션할 수 있습니다.
        // router.push('/login');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <nav className="flex items-center justify-between p-4 bg-black shadow-md">
        <Link href="/player">
          <h1 className="text-2xl inline font-extrabold tracking-widest cursor-pointer">ESCAPE ROOM</h1>
          <span className="text-sm text-gray-400 ml-2">player</span>
        </Link>
        
        {/* 드롭다운 메뉴 (사용자 정보 및 로그아웃) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="rounded-full h-10 w-10 p-0 text-white hover:bg-[#282828] border-gray-700"
            >
              {/* RiAdminFill 대신 사용자 관련 아이콘을 사용해도 좋습니다. */}
              <RiAdminFill className="h-8 w-8" /> 
              <span className="sr-only">사용자 메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#1f1f1f] text-white border-slate-700/70 mr-4">
            <DropdownMenuLabel className="truncate">
              {/* 현재 로그인된 사용자의 이메일 주소를 표시 */}
              {currentPlayerEmail}
            </DropdownMenuLabel> 
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

      <main className="p-8">
        <h1 className="text-3xl font-bold">플레이어 대시보드</h1>
        <p className="mt-4">
          여기에 테마 목록, 예약 내역 등 플레이어에게 필요한 콘텐츠를 추가할 수 있습니다.
        </p>
      </main>
    </div>
  );
}