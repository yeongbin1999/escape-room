"use client";
import { useState, useEffect, useRef } from "react";
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
import { useAuth } from "@/lib/authContext"; // Import useAuth hook

export default function HintThemeListPage() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError, isAuthReady } = useAuth(); // Use auth context

  // 상태 관리: 테마 목록, 로딩 상태, 에러 메시지
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true); // Loading for theme data
  const [error, setError] = useState<string | null>(null); // Error for theme fetching

  // 확인 모달 상태 관리: 모달 열림 여부 및 선택된 테마
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedThemeForConfirmation, setSelectedThemeForConfirmation] = useState<Theme | null>(null);

  // 시작 버튼에 포커스를 주기 위한 Ref
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch themes only when auth is ready and there's an authenticated user
  useEffect(() => {
    async function fetchThemesData() {
      if (user) { // Use user from auth context
        try {
          setLoading(true); // Start loading for themes
          const fetchedThemes = await getThemes();
          setThemes(fetchedThemes.filter(theme => theme.isActive));
          setError(null); // Clear any previous theme fetching errors
        } catch (err) {
          console.error("Error fetching themes:", err);
          setError("테마를 불러오는 데 실패했습니다. 권한을 확인해주세요."); // More specific error
        } finally {
          setLoading(false); // End loading for themes
        }
      } else if (isAuthReady && !user && !authLoading && !authError) {
        // If auth is ready, no user, not loading auth, and no auth error,
        // it means auto-signin failed or user is not supposed to be signed in.
        // But for this app, a user is expected, so we can show an error or specific message.
        // The authError from context will handle the 'auto sign-in failed' message.
        setLoading(false); // No user, so no themes to load
        setThemes([]); // Clear themes
        setError("로그인이 필요합니다. 관리자에게 문의하거나 다시 시도해주세요.");
      } else if (isAuthReady && !user && authError) {
        // If auth ready, no user, and there's an auth error, display that error.
        setLoading(false);
        setThemes([]);
        setError(authError);
      }
    }

    // Only run fetchThemesData if auth is ready.
    if (isAuthReady) {
      fetchThemesData();
    }
  }, [isAuthReady, user, authLoading, authError]); // Depend on auth context states


  // 테마 카드 선택 시 확인 모달 열기
  const handleSelectHintTheme = (theme: Theme) => {
    setSelectedThemeForConfirmation(theme);
    setIsConfirmDialogOpen(true);
  };

  // 모달에서 '시작하기' 클릭 시 테마 ID로 이동 (힌트 앱 시작)
  const confirmSelectHintTheme = () => {
    if (selectedThemeForConfirmation) {
      router.push(`/${selectedThemeForConfirmation.id}`);
    }
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };

  // 모달에서 '취소' 클릭 시 모달 닫기
  const cancelSelectHintTheme = () => {
    setIsConfirmDialogOpen(false);
    setSelectedThemeForConfirmation(null);
  };

  // 1. 로딩 상태 처리 (Auth loading or theme data loading)
  if (authLoading || !isAuthReady || loading) {
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

  // 2. 에러 상태 처리 (Auth error or theme fetching error)
  if (authError || error) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 text-center">{authError || error}</p>
      </div>
    );
  }

  // 3. 테마가 없는 경우 처리 (after successful auth and no themes fetched)
  if (themes.length === 0) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-xl">활성화된 테마가 없습니다.</p>
        <p className="text-gray-400 mt-2">관리자 페이지에서 테마를 생성하고 활성화해주세요.</p>
      </div>
    );
  }

  // 4. 정상 렌더링 (테마 목록 표시)
  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center px-6 py-4">
      <h1 className="text-3xl font-bold mb-8 mt-12">ESCAPE ROOM</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
        {/* 불러온 테마 목록을 ThemeCard 컴포넌트로 렌더링 */}
        {themes.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} onSelect={handleSelectHintTheme} />
        ))}
      </div>

      {/* 테마 선택 확인 AlertDialog (모달) */}
      {selectedThemeForConfirmation && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <AlertDialogContent
            className="
            bg-[#161616]
            text-white
            border-slate-600
            shadow-2xl
          "
            // 모달 열릴 때 '시작하기' 버튼에 자동 포커스
            onOpenAutoFocus={(event) => {
              event.preventDefault(); 
              startButtonRef.current?.focus();
            }}
          >
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
                ref={startButtonRef} // Ref 연결
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