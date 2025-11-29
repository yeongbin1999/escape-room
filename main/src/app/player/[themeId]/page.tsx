"use client"
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { getTheme, getProblemsByTheme } from '@/lib/firestoreService';
import { Theme, Problem } from '@/types/dbTypes';
import VideoPlayer from '@/components/player/VideoPlayer';
import AudioPlayer from '@/components/player/AudioPlayer';
import { useMediaUrl } from '@/lib/useMediaUrl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IoReturnDownBackSharp } from "react-icons/io5";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function PlayerGamePage() {
  const params = useParams();
  const { themeId } = params;

  // 테마 데이터 및 로딩/에러 상태
  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 테마의 오프닝 미디어 URL (커스텀 훅 사용)
  const videoUrl = useMediaUrl(theme?.openingVideoKey);
  const bgmUrl = useMediaUrl(theme?.openingBgmKey);

  // 사용자 입력 및 현재 활성화된 문제 미디어 키 상태
  const [answerInput, setAnswerInput] = useState('');
  const [activeProblemVideoKey, setActiveProblemVideoKey] = useState<string | null>(null);
  const [activeProblemBgmKey, setActiveProblemBgmKey] = useState<string | null>(null);

  // 활성화된 문제 미디어 URL
  const problemVideoUrl = useMediaUrl(activeProblemVideoKey); 
  const problemBgmUrl = useMediaUrl(activeProblemBgmKey);   

  // 미디어 재생 상태
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // 테마 오프닝 비디오
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);     // 테마 오프닝 BGM
  const [isProblemVideoPlaying, setIsProblemVideoPlaying] = useState(false); // 문제 반응 비디오
  const [isProblemBgmPlaying, setIsProblemBgmPlaying] = useState(false);     // 문제 반응 BGM
  const [hasMediaStarted, setHasMediaStarted] = useState(false);             // 최초 미디어 시작 여부
  const [isSubmitting, setIsSubmitting] = useState(false);                   // 정답 제출 로딩 상태

  // 화면에 표시될 문제 이미지/텍스트 상태 (오프닝 또는 문제 반응)
  const [displayedProblemImageKey, setDisplayedProblemImageKey] = useState<string | null>(null);
  const [displayedProblemText, setDisplayedProblemText] = useState<string | null>(null);
  const displayedProblemImageUrl = useMediaUrl(displayedProblemImageKey);

  // 일반 다이얼로그 상태 (주로 오답 메시지)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  // 다이얼로그 닫기 핸들러
  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setDialogMessage("");
  }, []);

  // 문제 비디오 재생 종료 핸들러: 비디오 종료 후 BGM 재생 시작
  const handleProblemVideoEnd = useCallback(() => {
    setIsProblemVideoPlaying(false);
    // 문제 BGM 키가 있고 URL이 준비되었으면 BGM 재생 시작
    if (activeProblemBgmKey && problemBgmUrl) {
      setIsProblemBgmPlaying(true);
    }
  }, [activeProblemBgmKey, problemBgmUrl]);

  // 정답 제출 핸들러
  const handleAnswerSubmit = useCallback(async () => {
    if (!themeId || typeof themeId !== 'string' || !problems.length || isSubmitting) {
      return; // 유효성 검사 및 중복 제출 방지
    }

    setIsSubmitting(true);

    try {
      const allTriggerProblems = problems.filter(p => p.type === "trigger");
      const matchingTriggerProblem = allTriggerProblems.find(p => answerInput.trim() === p.solution);

      // 문제 이미지/텍스트 초기화
      setDisplayedProblemImageKey(null);
      setDisplayedProblemText(null);

      if (matchingTriggerProblem) {
        // 정답인 경우: 모든 미디어 정지
        setIsVideoPlaying(false);        // 테마 비디오 정지
        setIsBgmPlaying(false);          // 테마 BGM 정지
        setIsProblemVideoPlaying(false); // 문제 비디오 정지
        setIsProblemBgmPlaying(false);   // 문제 BGM 정지
        setAnswerInput('');              // 입력 초기화

        // 문제별 미디어 키 설정
        setActiveProblemVideoKey(matchingTriggerProblem.media?.videoKey || null);
        setActiveProblemBgmKey(matchingTriggerProblem.media?.bgmKey || null);
        setDisplayedProblemImageKey(matchingTriggerProblem.media?.imageKey || null);
        setDisplayedProblemText(matchingTriggerProblem.media?.text || null);

        // 조건부 미디어 재생 시작
        if (matchingTriggerProblem.media?.videoKey) {
          setIsProblemVideoPlaying(true); // 비디오 우선 재생
        } else if (matchingTriggerProblem.media?.bgmKey) {
          setIsProblemBgmPlaying(true); // 비디오 없으면 BGM 재생
        }
      } else {
        // 오답인 경우
        setAnswerInput(''); // 입력 초기화
        setDialogMessage("오답입니다. 다시 시도해주세요.");
        setIsDialogOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [answerInput, problems, themeId, isSubmitting]);

  // Enter 키 입력 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME(한글/일본어/중국어 등) 입력 중이 아닐 때만 Enter 처리
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault(); // 기본 Enter 동작 방지
      handleAnswerSubmit();
    }
  }, [handleAnswerSubmit]);


  // 테마 및 문제 데이터 불러오기 (최초 1회 실행)
  useEffect(() => {
    async function fetchThemeData() {
      if (!themeId || typeof themeId !== 'string') {
        setError("유효하지 않은 테마 ID입니다.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedTheme = await getTheme(themeId);
        if (fetchedTheme) {
          setTheme(fetchedTheme);
          const fetchedProblems = await getProblemsByTheme(themeId);
          setProblems(fetchedProblems);
        } else {
          setError("테마를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("Error fetching theme:", err);
        setError("테마를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchThemeData();
  }, [themeId]); // themeId가 변경될 때만 재실행

  // 초기 미디어 재생 및 오프닝 이미지/텍스트 표시
  useEffect(() => {
    if (!loading && !error && theme && !hasMediaStarted) {
      // 오프닝 이미지/텍스트 설정 (항상 설정)
      if (theme.openingImageKey) {
        setDisplayedProblemImageKey(theme.openingImageKey);
      }
      if (theme.openingText) {
        setDisplayedProblemText(theme.openingText);
      }

      // 미디어 우선순위: 비디오 > BGM > 이미지/텍스트만
      if (theme.openingVideoKey && videoUrl) {
        setIsVideoPlaying(true);
        setHasMediaStarted(true);
      } else if (theme.openingBgmKey && bgmUrl) {
        setIsBgmPlaying(true);
        setHasMediaStarted(true);
      } else if (theme.openingImageKey || theme.openingText) {
        setHasMediaStarted(true); // 미디어 없이 콘텐츠만 있어도 시작으로 간주
      }
    }
  }, [loading, error, theme, hasMediaStarted, videoUrl, bgmUrl]); // 관련 상태/데이터 변경 시 재실행

  // 테마 오프닝 비디오 재생 종료 핸들러
  const handleVideoEnd = useCallback(() => {
    setIsVideoPlaying(false);
    // 문제 비디오가 재생 중이 아닐 때만 테마 BGM 재생 재개
    if (!isProblemVideoPlaying && theme?.openingBgmKey && bgmUrl) {
      setIsBgmPlaying(true);
    }
    // 비디오 종료 후 오프닝 이미지/텍스트 다시 표시
    if (theme?.openingImageKey) {
      setDisplayedProblemImageKey(theme.openingImageKey);
    }
    if (theme?.openingText) {
      setDisplayedProblemText(theme.openingText);
    }
  }, [bgmUrl, isProblemVideoPlaying, theme]);

  // 비디오 재생 시 스크롤 잠금 (오버레이 비디오를 위한 처리)
  useEffect(() => {
    if (isVideoPlaying || isProblemVideoPlaying) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // 컴포넌트 언마운트 시 스타일 복구
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVideoPlaying, isProblemVideoPlaying]);


  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center">
      
      {/* 1. 문제 반응 비디오 플레이어 (최우선 오버레이) */}
      {isProblemVideoPlaying && problemVideoUrl && (
        <VideoPlayer src={problemVideoUrl} onEnded={handleProblemVideoEnd} />
      )}

      {/* 2. 테마 오프닝 비디오 플레이어 (다음 오버레이) */}
      {!isProblemVideoPlaying && isVideoPlaying && videoUrl && (
        <VideoPlayer src={videoUrl} onEnded={handleVideoEnd} />
      )}

      {/* 3. 문제 반응 BGM 플레이어 (최우선 오디오) */}
      {isProblemBgmPlaying && problemBgmUrl && (
        <AudioPlayer src={problemBgmUrl} />
      )}

      {/* 4. 테마 오프닝 BGM 플레이어 (다음 오디오) */}
      {!isProblemBgmPlaying && isBgmPlaying && bgmUrl && (
        <AudioPlayer src={bgmUrl} />
      )}

      {/* 5. 미디어 로딩 인디케이터 (최초 로딩 시) */}
      {(loading || (theme && ((theme.openingVideoKey && !videoUrl) || (theme.openingBgmKey && !bgmUrl)))) && !hasMediaStarted && !isProblemVideoPlaying && !isProblemBgmPlaying && (
        <div className="flex items-center justify-center h-screen bg-[#1f1f1f] text-white">
          <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>로딩중</span>
        </div>
      )}
      
      {/* 6. 에러 메시지 */}
      {error && !loading && (
        <div className="text-red-500 text-center mt-8">
          <p>{error}</p>
          <Link href="/player" className="text-blue-500 hover:underline mt-4 inline-block">
            &larr; 테마 선택으로 돌아가기
          </Link>
        </div>
      )}

      {/* 7. 메인 게임 콘텐츠 (비디오가 재생 중이 아닐 때만 표시) */}
      {theme && !loading && !error && !isVideoPlaying && !isProblemVideoPlaying && (
        <div className="w-full max-w-3xl p-8">
          {displayedProblemImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={displayedProblemImageUrl} 
              alt="Problem Media" 
              className="w-full object-contain rounded-lg" 
            />
          )}
          {displayedProblemText && (
            <p className="text-md text-center mb-4 whitespace-pre-wrap">{displayedProblemText}</p>
          )}
          
          {/* 정답 입력 영역 */}
          <div className="relative group max-w-md mx-auto mt-4">
            <Input 
              type="text" 
              placeholder="" 
              className="w-full text-center text-3xl h-16 pr-12"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* 제출 버튼 */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
                 onClick={handleAnswerSubmit}
            >
              <IoReturnDownBackSharp size={24} />
            </div>
          </div>
        </div>
      )}

      {/* 8. 일반 다이얼로그 (오답 표시 등) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>알림</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-left">{dialogMessage}</p>
          </div>
          <DialogFooter>
            <Button 
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