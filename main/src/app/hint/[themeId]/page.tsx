"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
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

// Define a key for localStorage
const LOCAL_STORAGE_PROBLEMS_KEY_PREFIX = "hint_problems_";

export default function HintProblemPage() {
  const params = useParams();
  const { themeId } = params;

  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [foundHints, setFoundHints] = useState<string[]>([]); // State to store all found hints
  const [currentHintIndex, setCurrentHintIndex] = useState(0); // State to store the current hint index

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setDialogMessage("");
  }, []);

  const handleNextHint = useCallback(() => {
    if (currentHintIndex < foundHints.length - 1) {
      setCurrentHintIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentHintIndex, foundHints.length]);

  const handlePrevHint = useCallback(() => {
    if (currentHintIndex > 0) {
      setCurrentHintIndex((prevIndex) => prevIndex - 1);
    }
  }, [currentHintIndex]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!themeId || typeof themeId !== 'string' || !problems.length) {
      return;
    }

    const trimmedAnswer = answerInput.trim();
    if (!trimmedAnswer) {
      setDialogMessage("문제 코드를 입력해주세요.");
      setIsDialogOpen(true);
      return;
    }

    // Find problem with matching code (case-sensitive)
    const matchingProblem = problems.find(
      (p) => p.code.trim() === trimmedAnswer
    );

    if (matchingProblem) {
      setFoundHints(matchingProblem.hints);
      setCurrentHintIndex(0); // Start from the first hint
      setAnswerInput(""); // Clear input on successful match
      // No dialog here, hints are displayed directly on the page
    } else {
      setFoundHints([]); // Clear previous hints if no match
      setCurrentHintIndex(0); // Reset hint index
      setDialogMessage("일치하는 문제 코드를 찾을 수 없습니다.");
      setIsDialogOpen(true);
    }
  }, [answerInput, problems, themeId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleAnswerSubmit();
      }
    },
    [handleAnswerSubmit]
  );

  useEffect(() => {
    async function fetchData() {
      if (!themeId || typeof themeId !== "string") {
        setError("유효하지 않은 테마 ID입니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setFoundHints([]); // Clear any previous hints
      setCurrentHintIndex(0); // Reset hint index

      const localStorageKey = `${LOCAL_STORAGE_PROBLEMS_KEY_PREFIX}${themeId}`;

      // Try to load from localStorage first
      if (typeof window !== "undefined" && localStorage.getItem(localStorageKey)) {
        try {
          const storedData = JSON.parse(localStorage.getItem(localStorageKey)!);
          setTheme(storedData.theme);
          setProblems(storedData.problems);
          setLoading(false);
          console.log("Loaded problems from localStorage.");
          return; // Exit if data found and loaded
        } catch (e) {
          console.error("Failed to parse problems from localStorage:", e);
          localStorage.removeItem(localStorageKey); // Clear corrupted data
        }
      }

      // If not in localStorage or failed to load, fetch from network
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

          // Save to localStorage
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <Skeleton className="w-64 h-8 mb-4 bg-[#2d2d2d]" />
        <Skeleton className="w-full max-w-md h-12 bg-[#2d2d2d]" />
        <Skeleton className="w-full max-w-md h-32 mt-4 bg-[#2d2d2d]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 text-left">{error}</p>
        <Link href="/hint" className="text-blue-500 hover:underline mt-4">
          &larr; 다른 테마 선택으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center p-4">
      <Link href="/hint" className="absolute top-4 left-4 text-gray-400 hover:text-white">
        <IoIosArrowBack className="h-6 w-6" /> 
      </Link>

      <h1 className="text-3xl font-bold mt-12 mb-8">
        {theme?.title || "로딩 중..."}
      </h1>

      <div className="w-full max-w-md p-4 bg-[#282828] rounded-lg shadow-lg">
        <div className="relative group">
          <Input
            type="text"
            placeholder="해당 문제의 코드를 입력하면 힌트를 얻을 수 있습니다."
            className="w-full text-center text-xl h-12 pr-12 bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
            onClick={handleAnswerSubmit}
          >
            <IoReturnDownBackSharp size={24} />
          </div>
        </div>

        {foundHints.length > 0 && (
          <div className="mt-6 p-4 bg-[#1f1f1f] border border-[#4a4a4a] rounded-md">
            <div className="flex justify-between items-center mb-2">
                <Button 
                    onClick={handlePrevHint} 
                    disabled={currentHintIndex === 0}
                    className="bg-[#2d2d2d] text-white hover:bg-[#3d3d3d]"
                    size="icon"
                >
                    <FaArrowLeft />
                </Button>
                <h2 className="text-lg font-semibold text-white">
                    힌트 {currentHintIndex + 1}
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
            <p className="text-gray-200 text-center mt-5 whitespace-pre-wrap">{foundHints[currentHintIndex]}</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>알림</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-left">{dialogMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleDialogClose} type="button" variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
