"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getThemes } from "@/lib/firestoreService";
import { Theme } from "@/types/dbTypes";
import ThemeCard from "@/components/player/ThemeCard";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
export default function HintThemeListPage() {
  const router = useRouter(); // Initialize useRouter
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedThemeForConfirmation, setSelectedThemeForConfirmation] = useState<Theme | null>(null);

  useEffect(() => {
    async function fetchThemes() {
      try {
        setLoading(true);
        const fetchedThemes = await getThemes();
        setThemes(fetchedThemes.filter(theme => theme.isActive));
      } catch (err) {
        console.error("Error fetching themes:", err);
        setError("테마를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchThemes();
  }, []);

  const handleSelectHintTheme = (theme: Theme) => {
    setSelectedThemeForConfirmation(theme);
    setIsConfirmDialogOpen(true);
  };

  const confirmSelectHintTheme = () => {
    if (selectedThemeForConfirmation) {
      router.push(`/hint/${selectedThemeForConfirmation.id}`);
    }
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };

  const cancelSelectHintTheme = () => {
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center p-4">
        <h1 className="text-3xl font-bold mb-8 mt-12">ESCAPE ROOM</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 text-center">{error}</p>
        <Link href="/" className="text-blue-500 hover:underline mt-4">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-xl">활성화된 테마가 없습니다.</p>
        <p className="text-gray-400 mt-2">관리자 페이지에서 테마를 생성하고 활성화해주세요.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center px-6 py-4">
      <h1 className="text-3xl font-bold mb-8 mt-12">ESCAPE ROOM</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
        {themes.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} onSelect={handleSelectHintTheme} />
        ))}
      </div>

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
                {selectedThemeForConfirmation.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                선택한 테마의 힌트 앱을 시작하시겠습니까? <br></br>(오프라인 사용을 위해 데이터를 다운로드합니다.)
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={cancelSelectHintTheme}
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
                onClick={confirmSelectHintTheme}
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
