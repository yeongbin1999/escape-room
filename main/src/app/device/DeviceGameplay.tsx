import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProblemsByTheme, updateGameStateWithProblemSolution } from '@/lib/firestoreService';
import type { GameState, Theme, Problem } from '@/types/dbTypes';
import VideoPlayer from '@/components/player/VideoPlayer';
import AudioPlayer from '@/components/player/AudioPlayer';
import { useMediaUrl } from '@/lib/useMediaUrl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FaSpinner } from 'react-icons/fa';
import { IoReturnDownBackSharp } from "react-icons/io5";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// DeviceGameplay 컴포넌트의 props 인터페이스 정의
interface DeviceGameplayProps {
  gameState: GameState;
  theme: Theme;
  myDeviceId: string;
}

// DeviceGameplay 컴포넌트
export default function DeviceGameplay({ gameState, theme, myDeviceId }: DeviceGameplayProps) {
  const router = useRouter(); 

  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);

  // --- GameState로부터 파생된 상태 ---
  const myDeviceState = gameState.connectedDevices?.[myDeviceId];
  const myPersistentMedia = myDeviceState?.currentPersistentMedia;

  // myPersistentMedia.videoKey에서 타임스탬프 제거 (useMediaUrl에 전달하기 위함)
  const cleanVideoKey = useMemo(() => {
    return myPersistentMedia?.videoKey ? myPersistentMedia.videoKey.split('?')[0] : null;
  }, [myPersistentMedia?.videoKey]);

  // 미디어 URL 로딩 훅
  const { url: videoUrl, loading: videoLoading } = useMediaUrl(cleanVideoKey);
  const { url: imageUrl, loading: imageLoading } = useMediaUrl(myPersistentMedia?.imageKey);
  const { url: bgmUrl, loading: bgmLoading } = useMediaUrl(myPersistentMedia?.bgmKey);

  // --- 미디어 재생 관련 상태 ---
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // 현재 비디오 재생 여부
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);     // 현재 BGM 재생 여부
  // myPersistentMedia.videoKey 값이 Firestore에서 지워지지 않으므로,
  // 이미 재생된 비디오 키를 추적하여 무한 반복을 방지합니다.
  const [lastPlayedVideoKey, setLastPlayedVideoKey] = useState<string | null>(null); 
  
  // 정답 입력 필드 표시 여부
  const showAnswerInput = useMemo(() => {
    // currentProblem이 활성화되어 있고, 해당 문제가 내 장치 담당이며, trigger 타입이고, 아직 해결되지 않았을 때만 표시
    return currentProblem && currentProblem.device === myDeviceId && currentProblem.type === 'trigger' && !gameState.solvedProblems?.[currentProblem.code];
  }, [currentProblem, myDeviceId, gameState.solvedProblems]);

  // 키보드 단축키로 인한 새로고침 방지 (Hooks 규칙 준수를 위해 상단으로 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5, Ctrl+R (Windows/Linux), Cmd+R (Mac)
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault();
        console.log('새로고침이 차단되었습니다.'); // 개발자 도구에만 표시
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // myPersistentMedia 변경에 따른 미디어 재생 관리 Effect
  useEffect(() => {
    if (!myPersistentMedia) {
      setIsVideoPlaying(false);
      setIsBgmPlaying(false);
      return;
    }

    // 새로운 비디오가 있고 URL도 준비되었을 때만 비디오 재생
    if (myPersistentMedia.videoKey && myPersistentMedia.videoKey !== lastPlayedVideoKey && videoUrl) {
      setIsVideoPlaying(true);
      setIsBgmPlaying(false); // 비디오 재생 중 BGM 중지
    } 
    // 비디오가 없거나 이미 재생이 끝난 경우
    else if (!myPersistentMedia.videoKey || (myPersistentMedia.videoKey === lastPlayedVideoKey)) {
      setIsVideoPlaying(false); // 비디오 중지

      // BGM 재생 여부 결정
      if (myPersistentMedia.bgmKey) {
        setIsBgmPlaying(true);
      } else {
        setIsBgmPlaying(false);
      }
    }
    // 이펙트의 의존성 배열에 videoUrl 추가
  }, [myPersistentMedia?.videoKey, myPersistentMedia?.bgmKey, lastPlayedVideoKey, videoUrl]);


  // --- 게임 흐름 관련 Effects ---

  // gameState.currentProblemNumber 변경에 따른 현재 문제 업데이트 Effect
  useEffect(() => {
    async function fetchCurrentProblem() {
      if (!gameState.currentProblemNumber || !theme.id) {
        setCurrentProblem(null);
        return;
      }
      const problems = await getProblemsByTheme(theme.id);
      // 현재 장치에 할당된 trigger 문제만 찾음
      const problem = problems.find(p => p.number === gameState.currentProblemNumber && p.type === 'trigger' && p.device === myDeviceId);
      setCurrentProblem(problem || null);
    }
    fetchCurrentProblem();
    // currentProblemNumber가 변경되면 (재동기화 등) lastPlayedVideoKey를 초기화하여
    // 해당 시점의 비디오를 다시 재생할 수 있도록 함
    setLastPlayedVideoKey(null); // 이 라인을 다시 추가함
  }, [gameState.currentProblemNumber, theme.id, myDeviceId]); // myDeviceId 의존성 추가


  // --- 이벤트 핸들러 ---
  // 비디오 재생 종료 핸들러
  const handleVideoEnd = useCallback(() => {
    setIsVideoPlaying(false); // 비디오 재생 종료
    // myPersistentMedia.videoKey 값을 lastPlayedVideoKey로 저장하여 재시작 방지
    setLastPlayedVideoKey(myPersistentMedia?.videoKey || null); 
    
    // 비디오 종료 후 BGM 재생 (myPersistentMedia에 bgmKey가 있다면)
    if (myPersistentMedia?.bgmKey) {
      setIsBgmPlaying(true);
    }
  }, [myPersistentMedia?.videoKey, myPersistentMedia?.bgmKey]);

  // 정답 제출 핸들러
  const handleAnswerSubmit = useCallback(async () => {
    if (!currentProblem || !gameState || !myDeviceId || isSubmitting) return;

    setIsSubmitting(true);
    setDialogMessage(""); 
    setIsDialogOpen(false); 

    try {
      const allProblems = await getProblemsByTheme(theme.id); // `updateGameStateWithProblemSolution`에 필요
      const problemWithSolution = allProblems.find(p => p.id === currentProblem.id);

      if (!problemWithSolution) {
        setDialogMessage("문제를 찾을 수 없습니다. 관리자에게 문의해주세요.");
        setIsDialogOpen(true);
        return;
      }

      // 1. 제출된 정답이 맞는지 확인
      if (answerInput.trim() === problemWithSolution.solution) {
        // 정답인 경우
        await updateGameStateWithProblemSolution(gameState.id, problemWithSolution, myDeviceId, allProblems); 
        setAnswerInput(''); 
      } else {
        // 오답인 경우
        setDialogMessage("오답입니다. 다시 시도해주세요.");
        setIsDialogOpen(true);
        setAnswerInput(''); // 오답 시 입력창 초기화
      }
      
    } catch (err: any) {
      console.error("정답 제출 중 오류:", err);
      setDialogMessage(`정답 제출 중 오류 발생: ${err.message}`);
      setIsDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [answerInput, currentProblem, gameState, myDeviceId, isSubmitting, theme]);

  // 엔터 키 입력 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) { // 한글 입력 중 엔터 방지
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAnswerSubmit();
    }
  }, [handleAnswerSubmit]);

  // 다이얼로그 닫기 핸들러
  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setDialogMessage("");
  }, []);

  // --- 렌더링 로직 ---
  const isLoadingMedia = videoLoading || imageLoading || bgmLoading;

  // 장치 상태 로딩 중 (myDeviceState가 아직 없는 경우)
  if (!myDeviceState) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl mr-4" />
        <span>로딩 중...</span>
      </div>
    );
  }
  
  // 게임 상태별 화면 표시
  if (gameState.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-8 text-center">
        <p className="text-2xl font-bold mb-4">시작 대기 중</p>
        <p className="text-lg">테마: {theme.title}</p>
        <p className="text-lg">장치: {myDeviceId}</p>
      </div>
    );
  }

  if (gameState.status === 'paused') {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-8 text-center">
        <p className="text-2xl font-bold mb-4">게임 일시 정지</p>
        <p className="text-lg">잠시 기다려주세요.</p>
      </div>
    );
  }

  // if (gameState.status === 'ended') {
  //   return (
  //     <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-8 text-center">
  //       <p className="text-2xl font-bold mb-4">게임 종료됨</p>
  //       <p className="text-lg">참여해주셔서 감사합니다!</p>
  //       <Link href="/device" className="text-blue-400 hover:underline mt-8">
  //         &larr; 다시 연결
  //       </Link>
  //     </div>
  //   );
  // }

  // 기본 게임 플레이 화면
  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center">
      
      {/* Background BGM Player - BGM 재생 상태일 때만 렌더링 */}
      {isBgmPlaying && myPersistentMedia?.bgmKey && bgmUrl && <AudioPlayer src={bgmUrl} />}

      {/* Video Player - 비디오 재생 상태일 때만 렌더링 */}
      {isVideoPlaying && myPersistentMedia?.videoKey && videoUrl && (
        <VideoPlayer src={videoUrl} onEnded={handleVideoEnd} />
      )}

      {/* Main Game Content (비디오 재생 중이 아닐 때만 표시) */}
      {!isVideoPlaying && (
        <div className="w-full max-w-3xl p-8">
          {myPersistentMedia?.imageKey && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={imageUrl} 
              alt="Problem Media" 
              className="w-full object-contain rounded-lg cursor-pointer" 
              onClick={() => setIsImageModalOpen(true)}
            />
          )}
          {myPersistentMedia?.text && (
            <p className="text-md text-center mb-4 whitespace-pre-wrap">{myPersistentMedia.text}</p>
          )}
          
          {/* Answer Input Area - only if this device is responsible */}
          {showAnswerInput && currentProblem && (
            <div className="relative group max-w-md mx-auto mt-4">
              <Input 
                type="text" 
                placeholder="" 
                className="w-full text-center text-3xl h-16 pr-12"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
                   onClick={() => setIsImageModalOpen(true)} // onClick for icon
                   aria-disabled={isSubmitting}
              >
                <IoReturnDownBackSharp size={24} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* General Dialog (for wrong answers, etc.) */}
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

      {/* Image Zoom Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] bg-transparent border-none flex items-center justify-center p-0">
          <DialogHeader>
            <DialogTitle className="sr-only">확대 이미지</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={myPersistentMedia?.imageKey ? imageUrl || '' : ''} // Use imageUrl from myPersistentMedia
            alt="Enlarged Problem Media"
            className="w-full h-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}