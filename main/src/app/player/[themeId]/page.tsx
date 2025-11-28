"use client"
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { getTheme, getProblemsByTheme } from '@/lib/firestoreService';
import { Theme, Problem } from '@/types/dbTypes';
import VideoPlayer from '@/components/player/VideoPlayer';
import AudioPlayer from '@/components/player/AudioPlayer';
import { useMediaUrl } from '@/lib/useMediaUrl';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { IoReturnDownBackSharp } from "react-icons/io5";

export default function PlayerGamePage() {
  const params = useParams();
  const { themeId } = params;

  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoUrl = useMediaUrl(theme?.openingVideoKey);
  const bgmUrl = useMediaUrl(theme?.openingBgmKey);

  // State for user input and problem-specific media
  const [answerInput, setAnswerInput] = useState('');
  const [activeProblemVideoKey, setActiveProblemVideoKey] = useState<string | null>(null);
  const [activeProblemBgmKey, setActiveProblemBgmKey] = useState<string | null>(null);

  const problemVideoUrl = useMediaUrl(activeProblemVideoKey); // Triggered problem video URL
  const problemBgmUrl = useMediaUrl(activeProblemBgmKey);   // Triggered problem BGM URL

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [isProblemVideoPlaying, setIsProblemVideoPlaying] = useState(false);
  const [isProblemBgmPlaying, setIsProblemBgmPlaying] = useState(false);
  const [hasMediaStarted, setHasMediaStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // State for submission loading

  // Handler for when a problem-specific video ends
  const handleProblemVideoEnd = useCallback(() => {
    setIsProblemVideoPlaying(false);
    if (activeProblemBgmKey && problemBgmUrl) {
      setIsProblemBgmPlaying(true);
    }
  }, [activeProblemBgmKey, problemBgmUrl]);

  const handleAnswerSubmit = useCallback(async () => {
    console.log("handleAnswerSubmit: Function called.");
    if (!themeId || typeof themeId !== 'string' || !problems.length || isSubmitting) { // Prevent multiple submissions
      console.log("handleAnswerSubmit: Guard condition met.", { themeId, problemsLength: problems.length, isSubmitting });
      return;
    }

    setIsSubmitting(true); // Start submitting
    console.log("handleAnswerSubmit: Submission started.");

    try {
      const allTriggerProblems = problems.filter(p => p.type === "trigger");
      console.log("handleAnswerSubmit: All trigger problems found:", allTriggerProblems);

      const matchingTriggerProblem = allTriggerProblems.find(p => answerInput.toLowerCase() === p.solution.toLowerCase());

      if (matchingTriggerProblem) {
        console.log("handleAnswerSubmit: Correct answer found for problem:", matchingTriggerProblem);
        setIsVideoPlaying(false);        // Stop theme video
        setIsBgmPlaying(false);          // Stop theme BGM
        setIsProblemVideoPlaying(false); // Stop problem video (explicitly)
        setIsProblemBgmPlaying(false);   // Stop problem BGM (explicitly)
        setAnswerInput('');              // Clear input
        console.log("handleAnswerSubmit: All media playback states reset to false.");


        // Set problem specific media keys
        setActiveProblemVideoKey(matchingTriggerProblem.media?.videoKey || null);
        setActiveProblemBgmKey(matchingTriggerProblem.media?.bgmKey || null);
        console.log("handleAnswerSubmit: Problem media keys set.", { videoKey: matchingTriggerProblem.media?.videoKey, bgmKey: matchingTriggerProblem.media?.bgmKey });


        // Conditional playback of problem media
        if (matchingTriggerProblem.media?.videoKey) {
          setIsProblemVideoPlaying(true);
          console.log("handleAnswerSubmit: Playing problem video.");
        } else if (matchingTriggerProblem.media?.bgmKey) {
          setIsProblemBgmPlaying(true);
          console.log("handleAnswerSubmit: Playing problem BGM.");
        } else {
          console.log("handleAnswerSubmit: Matching trigger problem has no media. No problem media will play.");
        }
      } else {
        // Optional: Provide feedback for incorrect answer
        console.log("handleAnswerSubmit: Incorrect answer or no matching trigger problem found.");
      }
    } finally {
      setIsSubmitting(false); // End submitting
      console.log("handleAnswerSubmit: Submission ended.");
    }
  }, [answerInput, problems, themeId, isSubmitting]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log("handleKeyDown: Key pressed -", e.key);
    if (e.key === 'Enter') {
      console.log("handleKeyDown: Enter key detected, calling handleAnswerSubmit.");
      handleAnswerSubmit();
    }
  }, [handleAnswerSubmit]);


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
          const fetchedProblems = await getProblemsByTheme(themeId); // Fetch problems
          setProblems(fetchedProblems); // Set problems state
          console.log("fetchThemeData: Fetched problems:", fetchedProblems); // Log fetched problems
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
  }, [themeId]);

  useEffect(() => {
    if (!loading && !error && theme && !hasMediaStarted) {
      if (theme.openingVideoKey && videoUrl) {
        setIsVideoPlaying(true);
        setHasMediaStarted(true);
      } else if (theme.openingBgmKey && bgmUrl) {
        setIsBgmPlaying(true);
        setHasMediaStarted(true);
      }
    }
  }, [loading, error, theme, hasMediaStarted, videoUrl, bgmUrl]);

  const handleVideoEnd = () => {
    setIsVideoPlaying(false);
    // Only re-enable theme BGM if no problem video is currently playing
    if (!isProblemVideoPlaying && theme?.openingBgmKey && bgmUrl) {
      setIsBgmPlaying(true);
    }
  };

  useEffect(() => {
    // This effect should primarily control the body overflow based on *any* video playing
    if (isVideoPlaying || isProblemVideoPlaying) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVideoPlaying, isProblemVideoPlaying]);


  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col items-center justify-center">
      {/* Problem Video Player as an overlay - Highest priority */}
      {isProblemVideoPlaying && problemVideoUrl && (
        <VideoPlayer src={problemVideoUrl} onEnded={handleProblemVideoEnd} />
      )}

      {/* Theme Video Player as an overlay - Lower priority */}
      {!isProblemVideoPlaying && isVideoPlaying && videoUrl && (
        <VideoPlayer src={videoUrl} onEnded={handleVideoEnd} />
      )}

      {/* Problem Audio Player for BGM - Highest priority */}
      {isProblemBgmPlaying && problemBgmUrl && (
        <AudioPlayer src={problemBgmUrl} />
      )}

      {/* Theme Audio Player for BGM - Lower priority */}
      {!isProblemBgmPlaying && isBgmPlaying && bgmUrl && (
        <AudioPlayer src={bgmUrl} />
      )}

      {/* Media loading indicator - only show during initial media fetch */}
      {(loading || (theme && ((theme.openingVideoKey && !videoUrl) || (theme.openingBgmKey && !bgmUrl)))) && !hasMediaStarted && !isProblemVideoPlaying && !isProblemBgmPlaying && (
        <div className="flex items-center justify-center h-screen bg-[#1f1f1f] text-white">
          <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>로딩중</span>
        </div>
      )}
      
      {/* Error message */}
      {error && !loading && (
        <div className="text-red-500 text-center mt-8">
          <p>{error}</p>
          <Link href="/player" className="text-blue-500 hover:underline mt-4 inline-block">
            &larr; 테마 선택으로 돌아가기
          </Link>
        </div>
      )}

      {/* Game content - always show once theme data is loaded and no errors and no problem video playing */}
      {theme && !loading && !error && !isVideoPlaying && !isProblemVideoPlaying && (
        <div className="w-full max-w-md p-8">
          <div className="relative group">
            <Input 
              type="text" 
              placeholder="" 
              className="w-full text-center text-3xl h-16 pr-12"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-white cursor-pointer"
                 onClick={handleAnswerSubmit}
            >
              {isSubmitting ? (
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <IoReturnDownBackSharp size={24} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}