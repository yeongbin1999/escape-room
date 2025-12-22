import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProblemsByTheme, updateGameStateWithProblemSolution } from '@/lib/firestoreService';
import type { GameState, Theme, Problem, ConnectedDevice } from '@/types/dbTypes';
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

interface DeviceGameplayProps {
  gameState: GameState;
  theme: Theme;
  myDeviceId: string;
}

export default function DeviceGameplay({ gameState, theme, myDeviceId }: DeviceGameplayProps) {
  const router = useRouter(); 

  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);

  const myDeviceState = gameState.connectedDevices?.[myDeviceId];
  const myPersistentMedia = myDeviceState?.currentPersistentMedia;

  const cleanVideoKey = useMemo(() => {
    return myPersistentMedia?.videoKey ? myPersistentMedia.videoKey.split('?')[0] : null;
  }, [myPersistentMedia?.videoKey]);

  const { url: videoUrl, loading: videoLoading } = useMediaUrl(cleanVideoKey);
  const { url: imageUrl, loading: imageLoading } = useMediaUrl(myPersistentMedia?.imageKey);
  const { url: bgmUrl, loading: bgmLoading } = useMediaUrl(myPersistentMedia?.bgmKey);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [isImagePreloaded, setIsImagePreloaded] = useState(false);
  const [isMediaSequenceInitialized, setIsMediaSequenceInitialized] = useState(false);
  const lastProcessedMediaRef = useRef<ConnectedDevice['currentPersistentMedia'] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 이미지 프리로딩: 이미지 URL이 변경될 때 미리 로드하여 깜빡임 방지
  useEffect(() => {
    setIsImagePreloaded(false);

    if (!myPersistentMedia?.imageKey) {
      setIsImagePreloaded(true);
      return;
    }

    if (imageUrl) {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        setIsImagePreloaded(true);
      };
      img.onerror = () => {
        setIsImagePreloaded(true);
      };
    }
  }, [imageUrl, myPersistentMedia?.imageKey]);

  // 정답 입력창 노출 조건: 현재 문제의 담당 장치이고 트리거 타입이며 미해결 상태일 때
  const showAnswerInput = useMemo(() => {
    return currentProblem && currentProblem.device === myDeviceId && currentProblem.type === 'trigger' && !gameState.solvedProblems?.[currentProblem.code];
  }, [currentProblem, myDeviceId, gameState.solvedProblems]);

  // 게임 중 실수로 인한 새로고침(F5, Ctrl+R) 방지
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 미디어 재생 시퀀스 관리: 비디오 종료 후 BGM/이미지/텍스트로 이어지는 흐름 제어
  useEffect(() => {
    const currentVideoKey = myPersistentMedia?.videoKey;
    const currentBgmKey = myPersistentMedia?.bgmKey;
    const currentImageKey = myPersistentMedia?.imageKey;
    const currentText = myPersistentMedia?.text;

    const prevVideoKey = lastProcessedMediaRef.current?.videoKey;
    const prevBgmKey = lastProcessedMediaRef.current?.bgmKey;
    const prevImageKey = lastProcessedMediaRef.current?.imageKey;
    const prevText = lastProcessedMediaRef.current?.text;

    const mediaContentKeysChanged = 
        currentVideoKey !== prevVideoKey ||
        currentBgmKey !== prevBgmKey ||
        currentImageKey !== prevImageKey ||
        currentText !== prevText;

    if (!myPersistentMedia) {
      setIsVideoPlaying(false);
      setIsBgmPlaying(false);
      setIsMediaSequenceInitialized(false);
      lastProcessedMediaRef.current = null;
      return;
    }

    if (mediaContentKeysChanged || !isMediaSequenceInitialized) {
      setIsVideoPlaying(false);
      setIsBgmPlaying(false);
      setIsMediaSequenceInitialized(false);
      
      if (mediaContentKeysChanged) {
        lastProcessedMediaRef.current = { ...myPersistentMedia };
      }

      if (myPersistentMedia.videoKey && !videoUrl) return;
      if (myPersistentMedia.bgmKey && !bgmUrl) return;
      if (myPersistentMedia.imageKey && !imageUrl) return;

      const hasVideo = !!myPersistentMedia.videoKey;
      const hasBgm = !!myPersistentMedia.bgmKey;

      if (hasVideo && videoUrl) {
        setIsVideoPlaying(true);
      } else {
        if (hasBgm && bgmUrl) {
          setIsBgmPlaying(true);
        }
        setIsMediaSequenceInitialized(true);
      }
    }
  }, [myPersistentMedia, isMediaSequenceInitialized, videoUrl, bgmUrl, imageUrl, videoLoading, bgmLoading, imageLoading]);

  // 문제 데이터 동기화: 게임 상태 변경 시 현재 장치가 풀어야 할 문제 정보 가져오기
  useEffect(() => {
    async function fetchCurrentProblem() {
      if (!gameState.currentProblemNumber || !theme.id) {
        setCurrentProblem(null);
        return;
      }
      const problems = await getProblemsByTheme(theme.id);
      const problem = problems.find(p => p.number === gameState.currentProblemNumber && p.type === 'trigger' && p.device === myDeviceId);
      setCurrentProblem(problem || null);
    }
    fetchCurrentProblem();
    setIsMediaSequenceInitialized(false);
  }, [gameState.currentProblemNumber, theme.id, myDeviceId]);

  // 비디오 재생 완료 시 실행: 비디오를 끄고 BGM 및 텍스트/이미지 활성화
  const handleVideoEnd = useCallback(() => {
    setIsVideoPlaying(false);
    if (myPersistentMedia?.bgmKey && bgmUrl) {
      setIsBgmPlaying(true);
    }
    setIsMediaSequenceInitialized(true);
  }, [myPersistentMedia?.bgmKey, bgmUrl]);

  // 정답 제출 로직: 입력값 검증 및 정답 시 게임 상태 업데이트
  const handleAnswerSubmit = useCallback(async () => {
    if (!currentProblem || !gameState || !myDeviceId || isSubmitting) return;

    setIsSubmitting(true);
    setDialogMessage(""); 
    setIsDialogOpen(false); 

    try {
      const allProblems = await getProblemsByTheme(theme.id);
      const problemWithSolution = allProblems.find(p => p.id === currentProblem.id);

      if (!problemWithSolution) {
        setDialogMessage("문제를 찾을 수 없습니다. 관리자에게 문의해주세요.");
        setIsDialogOpen(true);
        return;
      }

      if (answerInput.trim() === problemWithSolution.solution) {
        await updateGameStateWithProblemSolution(gameState.id, problemWithSolution, myDeviceId, allProblems); 
        setAnswerInput(''); 
      } else {
        setDialogMessage("오답입니다. 다시 시도해주세요.");
        setIsDialogOpen(true);
        setAnswerInput('');
      }
      
    } catch (err: any) {
      console.error("정답 제출 중 오류:", err);
      setDialogMessage(`정답 제출 중 오류 발생: ${err.message}`);
      setIsDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [answerInput, currentProblem, gameState, myDeviceId, isSubmitting, theme]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAnswerSubmit();
    }
  }, [handleAnswerSubmit]);

  // 입력 필드 자동 포커스
  useEffect(() => {
    if (showAnswerInput && !isVideoPlaying && isMediaSequenceInitialized && isImagePreloaded && !isDialogOpen && !isSubmitting) {
      // 약간의 딜레이 후 포커스를 주어 다른 UI 렌더링과의 충돌 방지
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [showAnswerInput, isVideoPlaying, isMediaSequenceInitialized, isImagePreloaded, isDialogOpen, isSubmitting]);

  // 다이얼로그 닫기 후 입력창에 포커스 반환
  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setDialogMessage("");
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }, []);

  if (!myDeviceState) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl mr-4" />
        <span>로딩 중...</span>
      </div>
    );
  }
  
  if (gameState.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center p-8 text-center">
        <p className="text-2xl font-bold mb-4">테마 '{theme.title}'</p>
        <p className="text-lg">게임 세션 코드: {gameState.gameCode}</p>
        <p className="text-lg">장치 설정: {myDeviceId}</p>
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

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center">
      
      {/* BGM 및 비디오 플레이어 섹션 */}
      {isBgmPlaying && myPersistentMedia?.bgmKey && bgmUrl && <AudioPlayer src={bgmUrl} />}
      {isVideoPlaying && myPersistentMedia?.videoKey && videoUrl && (
        <VideoPlayer src={videoUrl} onEnded={handleVideoEnd} />
      )}

      {/* 게임 콘텐츠 렌더링 (이미지, 텍스트, 정답 입력창) */}
      {!isVideoPlaying && isMediaSequenceInitialized && isImagePreloaded && (
        <div className="w-full max-w-3xl p-8">
          <>
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

            {showAnswerInput && currentProblem && (
              <div className="relative group max-w-md mx-auto mt-4">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder=""
                  className="w-full text-center text-3xl h-16 pr-12"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                />
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
                  onClick={() => setIsImageModalOpen(true)}
                >
                  <IoReturnDownBackSharp size={24} />
                </div>
              </div>
            )}
          </>
        </div>
      )}

      {/* 결과 알림 및 이미지 확대 모달 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>알림</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-left">{dialogMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleDialogClose} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] bg-transparent border-none flex items-center justify-center p-0">
          <DialogHeader>
            <DialogTitle className="sr-only">확대 이미지</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={myPersistentMedia?.imageKey ? imageUrl || '' : ''}
            alt="Enlarged Problem Media"
            className="w-full h-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}