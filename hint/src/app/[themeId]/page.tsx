"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getTheme, getProblemsByTheme } from "@/lib/firestoreService";
import { Theme, Problem } from "@/types/dbTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IoReturnDownBackSharp } from "react-icons/io5";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IoIosArrowBack } from "react-icons/io";

// 로컬 스토리지 키 정의
const LOCAL_STORAGE_PROBLEMS_KEY_PREFIX = "hint_problems_";

export default function HintProblemPage() {
  const params = useParams();
  const { themeId } = params;

  // 상태 관리
  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 힌트 입력 및 결과 관련 상태
  const [answerInput, setAnswerInput] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [foundHints, setFoundHints] = useState<string[]>([]); // 현재 찾은 문제의 힌트 목록
  const [currentHintIndex, setCurrentHintIndex] = useState(0); // 현재 표시 중인 힌트 인덱스

  // 다이얼로그 '확인' 버튼 포커스를 위한 Ref
  const okButtonRef = useRef<HTMLButtonElement>(null); 

  // 다이얼로그 닫기 핸들러
  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setDialogMessage("");
  }, []);

  // 다음 힌트 보기 핸들러
  const handleNextHint = useCallback(() => {
    if (currentHintIndex < foundHints.length - 1) {
      setCurrentHintIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentHintIndex, foundHints.length]);

  // 이전 힌트 보기 핸들러
  const handlePrevHint = useCallback(() => {
    if (currentHintIndex > 0) {
      setCurrentHintIndex((prevIndex) => prevIndex - 1);
    }
  }, [currentHintIndex]);

  // 문제 코드 제출 및 힌트 검색 로직
  const handleAnswerSubmit = useCallback(async () => {
    if (!themeId || typeof themeId !== 'string' || !problems.length) return;

    const trimmedAnswer = answerInput.trim();
    if (!trimmedAnswer) {
      setDialogMessage("문제 코드를 입력해주세요.");
      setIsDialogOpen(true);
      return;
    }

    // 일치하는 문제 코드 찾기 (대소문자 구분)
    const matchingProblem = problems.find(
      (p) => p.code.trim() === trimmedAnswer
    );

    if (matchingProblem) {
      setFoundHints(matchingProblem.hints); // 힌트 목록 업데이트
      setCurrentHintIndex(0); // 첫 번째 힌트부터 시작
      setAnswerInput(""); // 입력창 비우기
    } else {
      setFoundHints([]); // 힌트 목록 초기화
      setCurrentHintIndex(0); 
      setDialogMessage("일치하는 문제 코드를 찾을 수 없습니다.");
      setIsDialogOpen(true);
    }
  }, [answerInput, problems, themeId]);

  // Enter 키 입력 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // IME 입력 중이 아닐 때만 Enter 처리
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleAnswerSubmit();
      }
    },
    [handleAnswerSubmit]
  );

  // 데이터 불러오기 (로컬 스토리지 우선 시도 후, 네트워크 폴백)
  useEffect(() => {
    async function fetchData() {
      if (!themeId || typeof themeId !== "string") {
        setError("유효하지 않은 테마 ID입니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setFoundHints([]); 
      setCurrentHintIndex(0); 

      const localStorageKey = `${LOCAL_STORAGE_PROBLEMS_KEY_PREFIX}${themeId}`;

      // 1. 로컬 스토리지에서 데이터 로드 시도
      if (typeof window !== "undefined" && localStorage.getItem(localStorageKey)) {
        try {
          const storedData = JSON.parse(localStorage.getItem(localStorageKey)!);
          setTheme(storedData.theme);
          setProblems(storedData.problems);
          setLoading(false);
          console.log("Loaded problems from localStorage.");
          return; // 로드 성공 시 함수 종료
        } catch (e) {
          console.error("Failed to parse problems from localStorage:", e);
          localStorage.removeItem(localStorageKey); // 손상된 데이터 정리
        }
      }

      // 2. 네트워크에서 데이터 불러오기 (로컬 스토리지에 없거나 실패했을 경우)
      try {
        if (!navigator.onLine) {
          setError("오프라인 상태에서는 이 테마를 처음 로드할 수 없습니다. 온라인 상태에서 한 번 로드해주세요.");
          return;
        }

        const fetchedTheme = await getTheme(themeId);
        if (fetchedTheme) {
          setTheme(fetchedTheme);
          const fetchedProblems = await getProblemsByTheme(themeId);
          setProblems(fetchedProblems);

          // 로컬 스토리지에 저장
          if (typeof window !== "undefined") {
            localStorage.setItem(localStorageKey, JSON.stringify({ theme: fetchedTheme, problems: fetchedProblems }));
            console.log("Saved problems to localStorage.");
          }
        } else {
          setError("테마를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [themeId]);

  // 1. 로딩 상태 처리
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        {/* 스켈레톤 UI를 사용하여 로딩 중임을 표시 */}
        <Skeleton className="w-64 h-8 mb-4 bg-[#2d2d2d]" />
        <Skeleton className="w-full max-w-md h-12 bg-[#2d2d2d]" />
        <Skeleton className="w-full max-w-md h-32 mt-4 bg-[#2d2d2d]" />
      </div>
    );
  }

  // 2. 에러 상태 처리
  if (error) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 text-left">{error}</p>
        <Link href="/" className="text-blue-500 hover:underline mt-4">
          &larr; 다른 테마 선택으로 돌아가기
        </Link>
      </div>
    );
  }

  // 3. 정상 렌더링
  return (
    <div className="h-screen bg-[#1f1f1f] text-white flex flex-col items-center p-4">
      {/* 뒤로 가기 링크 */}
      <Link href="/" className="absolute top-4 left-4 text-gray-400 hover:text-white flex-shrink-0">
        <IoIosArrowBack className="h-6 w-6" /> 
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold mt-4 mb-4 text-center flex-shrink-0">
        {theme?.title || "테마 이름"}
      </h1>

      {/* 메인 컨테이너: flex-grow로 화면을 채우고, 힌트 영역이 유동적으로 크기를 조절하도록 함 */}
      <div className="w-full max-w-md mx-auto p-4 bg-[#282828] rounded-lg shadow-lg flex-grow flex flex-col">
        
        {/* 문제 코드 입력창 */}
        <div className="relative group mb-4 flex-shrink-0">
          <Input
            type="text"
            className="w-full text-center text-xl h-12 pr-12 bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {/* 제출 버튼 아이콘 */}
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
            onClick={handleAnswerSubmit}
          >
            <IoReturnDownBackSharp size={24} />
          </div>
        </div>

        {/* 힌트 표시 영역 */}
        {foundHints.length > 0 ? (
          // 힌트가 있을 때: 힌트 박스가 남은 공간을 모두 채움
          <div className="mt-2 p-4 bg-[#1f1f1f] border border-[#4a4a4a] rounded-md flex-grow flex flex-col">
            
            {/* 힌트 네비게이션 버튼 및 인덱스 표시 */}
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <Button 
                    onClick={handlePrevHint} 
                    disabled={currentHintIndex === 0}
                    className="bg-[#2d2d2d] text-white hover:bg-[#3d3d3d]"
                    size="icon"
                >
                    <FaArrowLeft />
                </Button>
                <h2 className="text-lg font-semibold text-white text-center">
                    힌트 {currentHintIndex + 1} / {foundHints.length}
                </h2>
                <Button 
                    onClick={handleNextHint} 
                    disabled={currentHintIndex === foundHints.length - 1}
                    className="bg-[#2d2d2d] text-white hover:bg-[#3d3d3d]"
                    size="icon"
                >
                    <FaArrowRight />
                </Button>
            </div>
            
            {/* 실제 힌트 내용 (가운데 정렬) */}
            <div className="flex-grow flex items-center justify-center overflow-y-auto">
              <p className="text-gray-200 text-center whitespace-pre-wrap p-2">
                {foundHints[currentHintIndex]}
              </p>
            </div>
          </div>
        ) : (
          /* 힌트가 없을 때 안내 메시지 (남은 공간을 모두 채움) */
          <div className="mt-2 p-4 bg-[#1f1f1f] border border-[#4a4a4a] rounded-md flex-grow flex items-center justify-center">
              <p className="text-gray-400">문제 코드를 입력하고 힌트를 받아보세요.</p>
          </div>
        )}
      </div>

      {/* 알림 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70"
          // '확인' 버튼에 포커스
          onOpenAutoFocus={(event) => {
            event.preventDefault(); 
            okButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>알림</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-left">{dialogMessage}</p>
          </div>
          <DialogFooter>
            <Button
              ref={okButtonRef} 
              onClick={handleDialogClose}
              type="button"
              variant="outline"
              className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}