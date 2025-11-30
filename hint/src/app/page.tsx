"use client";
import { useState, useEffect, useRef } from "react";
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
  const router = useRouter();
  
  // 상태 관리: 테마 목록, 로딩 상태, 에러 메시지
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 확인 모달 상태 관리: 모달 열림 여부 및 선택된 테마
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedThemeForConfirmation, setSelectedThemeForConfirmation] = useState<Theme | null>(null);

  // 시작 버튼에 포커스를 주기 위한 Ref
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // 컴포넌트 마운트 시 활성화된 테마 목록 불러오기
  useEffect(() => {
    async function fetchThemes() {
      try {
        setLoading(true);
        const fetchedThemes = await getThemes();
        // 활성화된(isActive: true) 테마만 필터링하여 저장
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

  // 1. 로딩 상태 처리 (스켈레톤/표시 내용 없음)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] flex flex-col items-center justify-center p-4">
        {/* 상위 컴포넌트의 로딩 스피너가 표시되도록 비워둠 */}
      </div>
    );
  }

  // 2. 에러 상태 처리
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

  // 3. 테마가 없는 경우 처리
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