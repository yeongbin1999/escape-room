"use client"
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { auth } from "@/lib/firebaseConfig"; 
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { RiAdminFill } from "react-icons/ri";
import { getThemes } from "@/lib/firestoreService";
import { Theme } from "@/types/dbTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import ThemeCard from "@/components/player/ThemeCard";


export default function PlayerPage() {
  const router = useRouter(); 
  const [currentPlayerEmail, setCurrentPlayerEmail] = useState<string>('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [errorThemes, setErrorThemes] = useState<string | null>(null);
  
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedThemeForConfirmation, setSelectedThemeForConfirmation] = useState<Theme | null>(null);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentPlayerEmail(user.email || '사용자');
      } else {
        setCurrentPlayerEmail('');
        router.push('/'); // Redirect to home if not logged in
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function fetchThemes() {
      try {
        setLoadingThemes(true);
        const fetchedThemes = await getThemes();
        setThemes(fetchedThemes.filter(theme => theme.isActive)); // Only show active themes
      } catch (error) {
        console.error("Error fetching themes:", error);
        setErrorThemes("테마를 불러오는 데 실패했습니다.");
      } finally {
        setLoadingThemes(false);
      }
    }
    fetchThemes();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
      // NOTE: alert() 대신 custom modal UI를 사용해야 합니다. 여기서는 콘솔 로그로 대체합니다.
      console.error("로그아웃 중 오류가 발생했습니다.");
    }
  };

  const handleThemeSelect = (theme: Theme) => {
    setSelectedThemeForConfirmation(theme);
    setIsConfirmDialogOpen(true);
  };

  const confirmStartGame = () => {
    if (selectedThemeForConfirmation) {
      router.push(`/player/${selectedThemeForConfirmation.id}`); // Navigate to the player game page
    }
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };




  const cancelStartGame = () => {
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };


  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col">
      <nav className="flex items-center justify-between p-4 bg-black shadow-md z-10">
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

      <main 
        className="
          flex-grow 
          p-4 
          sm:p-6 
          md:p-8
          lg:px-40 lg:py-25
          overflow-auto custom-scroll"
        style={{ scrollbarGutter: 'stable both' }} 
      >
        {loadingThemes && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white border border-black p-0 overflow-hidden">
                <div className="h-48 sm:h-56 md:h-64 bg-gray-300 animate-pulse"></div>
                <CardHeader className="p-4 pb-2">
                  <Skeleton className="h-4 w-[70%] bg-gray-300" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Skeleton className="h-4 w-full mb-2 bg-gray-300" />
                  <Skeleton className="h-4 w-[80%] bg-gray-300" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {errorThemes && (
          <div className="text-red-500 text-center mt-8">{errorThemes}</div>
        )}

        {!loadingThemes && themes.length === 0 && !errorThemes && (
          <div className="text-center text-gray-400 mt-8">사용 가능한 테마가 없습니다.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {themes.map((theme) => (
            <ThemeCard 
              key={theme.id} 
              theme={theme} 
              onSelect={handleThemeSelect}
            />
          ))}
        </div>
      </main>

      {selectedThemeForConfirmation && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <AlertDialogContent className="
            bg-[#161616] 
            text-white 
            border-slate-600 
            shadow-2xl
          ">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-400">
                {selectedThemeForConfirmation.title} 테마 시작 확인
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                선택한 테마의 게임을 지금 바로 시작하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={cancelStartGame} 
                className="
                  text-white 
                  border-gray-700 
                  hover:bg-[#282828] 
                  hover:text-gray-300
                "
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmStartGame}
                className="
                  bg-orange-600 
                  text-white 
                  hover:bg-orange-700 
                  border-none 
                  focus:ring-2 
                  focus:ring-orange-500
                "
              >
                시작하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}