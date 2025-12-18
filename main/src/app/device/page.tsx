"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebaseConfig";
import { signOut } from "firebase/auth";
import { findSessionByGameCode, subscribeToGameState, getTheme, updateGameState, getGameState } from "@/lib/firestoreService";
import { Timestamp } from "firebase/firestore";
import type { GameState, Theme } from "@/types/dbTypes";

// UI Components
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FaSpinner, FaUsers } from "react-icons/fa";
import { MdOutlineMonitor, MdTablet } from "react-icons/md";
import { RiAdminFill } from "react-icons/ri";
import DeviceGameplay from "./DeviceGameplay";

/**
 * 장치 ID에 따른 아이콘 렌더링
 */
const getDeviceIcon = (deviceId: string) => {
  if (deviceId === '기본장치') return <MdOutlineMonitor className="inline mr-2" />;
  if (deviceId.toLowerCase().includes('tablet')) return <MdTablet className="inline mr-2" />;
  return <FaUsers className="inline mr-2" />;
};

export default function DevicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlGameCode = searchParams.get("gameCode");
  const urlDeviceId = searchParams.get("deviceId");

  // --- 상태 관리 ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(urlDeviceId);
  
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [currentPlayerEmail, setCurrentPlayerEmail] = useState<string>('');
  const [gameCodeArray, setGameCodeArray] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const selectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [currentActiveGameCode, setCurrentActiveGameCode] = useState<string | null>(urlGameCode);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // --- [Timer Effect] 5초마다 현재 시간을 업데이트하여 장치 연결 끊김 판별 ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); 

    return () => clearInterval(timer);
  }, []);

  // --- [Auth Effect] 사용자 로그인 상태 및 권한 확인 ---
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentPlayerEmail(user.email || '사용자');
      } else {
        router.push('/'); 
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --- [Game Data Effects] 게임 세션 조회 및 실시간 데이터 구독 설정 ---
  useEffect(() => {
    let unsubscribe: () => void;
    async function initializeSession() {
      if (!currentActiveGameCode) { setLoading(false); return; }
      try {
        setLoading(true);
        const fetchedGameState = await findSessionByGameCode(currentActiveGameCode);
        if (fetchedGameState) {
          setGameState(fetchedGameState);
          const fetchedTheme = await getTheme(fetchedGameState.themeId);
          setTheme(fetchedTheme);
          unsubscribe = subscribeToGameState(fetchedGameState.id, (latest) => {
            setGameState(latest);
            if (latest?.themeId !== fetchedGameState.themeId) getTheme(latest!.themeId).then(setTheme);
          });
        } else { setError("유효하지 않은 게임 코드입니다."); }
      } catch (err: any) { setError(`세션 로드 실패: ${err.message}`); } finally { setLoading(false); }
    }
    initializeSession();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [currentActiveGameCode]);

  // --- [Heartbeat Effect] 장치가 연결된 경우 15초마다 온라인 상태 갱신 ---
  useEffect(() => {
    if (!gameState || !myDeviceId) return;

    const connectDevice = () => {
      updateGameState(gameState.id, {
        connectedDevices: {
          ...gameState.connectedDevices,
          [myDeviceId]: {
            status: 'connected',
            lastSeen: Timestamp.now(),
            currentPersistentMedia: gameState.connectedDevices[myDeviceId]?.currentPersistentMedia || {
              imageKey: null, text: null, bgmKey: null, lastVideoKey: null,
            },
          }
        }
      }).catch((err: any) => {
        setError(`장치 연결 상태 업데이트 실패: ${err.message}`);
      });
    };

    connectDevice();

    const interval = setInterval(() => {
        updateGameState(gameState.id, { [`connectedDevices.${myDeviceId}.lastSeen`]: Timestamp.now() }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [gameState?.id, myDeviceId]);

  // --- 핸들러 ---
  const handleLogout = async () => {
    try { await signOut(auth); router.push('/'); } catch (err) { console.error(err); }
  };

  const handleInputChange = (index: number, value: string) => {
    const char = value.toUpperCase().slice(-1);
    if (char && !/^[A-Z0-9]$/.test(char)) return;
    const newArray = [...gameCodeArray];
    newArray[index] = char;
    setGameCodeArray(newArray);
    if (char && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !gameCodeArray[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "Enter" && isCodeComplete) handleGameCodeSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").toUpperCase().trim();
    if (/^[A-Z0-9]{4,}$/.test(pasteData)) {
      const newArray = pasteData.split("").slice(0, 4);
      setGameCodeArray(newArray);
      inputRefs.current[3]?.focus();
    }
  };

  const handleGameCodeSubmit = () => {
    const fullCode = gameCodeArray.join("");
    if (fullCode.length === 4) { setCurrentActiveGameCode(fullCode); setError(null); }
  };

  // 장치 선택 후 실제 게임 화면으로 진입하는 핸들러
  const handleSelectAndConnectDevice = async () => {
    if (!selectedDeviceId || !gameState) return;

    setLoading(true);
    try {
      const latestGameState = await getGameState(gameState.id);
      if (!latestGameState) {
        setError("세션을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const device = latestGameState.connectedDevices?.[selectedDeviceId];
      const lastSeenDate = device?.lastSeen?.toDate();
      const isStale = lastSeenDate ? (new Date().getTime() - lastSeenDate.getTime()) > 30000 : true;
      
      if (device && (device.status === 'connected' || device.status === 'ready') && !isStale) {
        setError(`장치가 이미 사용 중입니다.`);
        setGameState(latestGameState);
        setLoading(false);
        return;
      }
      
      setMyDeviceId(selectedDeviceId);
    } catch (err) {
      setError("연결 확인 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  const isCodeComplete = useMemo(() => gameCodeArray.every(char => char !== ""), [gameCodeArray]);

  // 연결 가능한 장치 목록 계산
  const availableDevicesForSelection = useMemo(() => {
    if (!gameState || !theme) return [];
    const all = ['기본장치', ...(theme.availableDevices || [])];

    return all.filter(id => {
      const device = gameState.connectedDevices?.[id];
      if (!device || !device.status) return true;
      const lastSeenDate = device.lastSeen?.toDate();
      const isStale = lastSeenDate ? (currentTime.getTime() - lastSeenDate.getTime()) > 30000 : true;
      return isStale || (device.status !== 'connected' && device.status !== 'ready');
    });
  }, [gameState, theme, currentTime]);

  useEffect(() => {
    if (availableDevicesForSelection.length > 0 && !myDeviceId) {
      if (!selectedDeviceId || !availableDevicesForSelection.includes(selectedDeviceId)) {
        setSelectedDeviceId(availableDevicesForSelection[0]);
      }
      selectTriggerRef.current?.focus();
    }
  }, [availableDevicesForSelection, myDeviceId, selectedDeviceId]);

  // --- 렌더링 함수: 상단바 ---
  const renderNavbar = () => (
    <nav className="flex items-center justify-between p-4 bg-black shadow-md z-10 w-full">
      <Link href="/device">
        <div className="flex items-baseline">
          <h1 className="text-2xl font-extrabold tracking-widest cursor-pointer text-white">ESCAPE ROOM</h1>
          <span className="text-sm text-gray-400 ml-2 font-mono">device</span>
        </div>
      </Link>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-full h-10 w-10 p-0 text-white hover:bg-[#282828] border-gray-700">
            <RiAdminFill className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-[#1f1f1f] text-white border-slate-700/70 mr-4">
          <DropdownMenuLabel className="truncate opacity-70 font-normal text-xs">{currentPlayerEmail}</DropdownMenuLabel> 
          <DropdownMenuSeparator className="bg-slate-700/70" />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400">
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col">
      {/* [수정 포인트] 장치가 최종 연결(myDeviceId가 설정됨)된 상태가 아닐 때만 상단바를 렌더링합니다. */}
      {!myDeviceId && renderNavbar()}

      <main className="flex-grow flex flex-col">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <div className="flex flex-col items-center">
                <FaSpinner className="animate-spin text-4xl mb-4 text-blue-500" />
                <span className="text-gray-400">연결 확인 중...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-2xl text-center max-w-sm w-full">
              <p className="text-red-500 font-bold mb-2 font-mono">ERROR</p>
              <p className="text-gray-400 text-sm mb-6">{error}</p>
              <Button onClick={() => { setCurrentActiveGameCode(null); setError(null); setGameCodeArray(["","","",""]); }} variant="outline" className="w-full border-red-500 text-red-500 hover:bg-red-500">
                다시 입력
              </Button>
            </div>
          </div>
        ) : !currentActiveGameCode ? (
          /* 단계 1: 4자리 게임 코드 입력 화면 */
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <h2 className="text-4xl font-black mb-2 tracking-tighter text-white">Device Connect</h2>
              <p className="text-gray-500 mb-10 text-sm uppercase tracking-widest">4자리 게임 코드를 입력하고 연결하세요.</p>
              <div className="flex gap-3 mb-8">
                {gameCodeArray.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    value={char}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    className="w-14 h-20 bg-[#1e1e1e] border-2 border-white rounded-xl text-center text-3xl font-bold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                  />
                ))}
              </div>
              <Button 
                onClick={handleGameCodeSubmit} 
                disabled={!isCodeComplete}
                className={`w-[73%] h-12 text-xl font-bold rounded-xl transition-all ${
                  isCodeComplete ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20" : "bg-[#252525] text-gray-600 cursor-not-allowed border border-white/5"
                }`}
              >
                연결 시도
              </Button>
            </div>
          </div>
        ) : !myDeviceId ? (
          /* 단계 2: 장치 용도(역할) 선택 화면 */
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-1">장치 선택</h2>
              <p className="text-gray-500 mb-8 text-sm">이 단말기의 용도를 선택해 주세요.</p>
              {availableDevicesForSelection.length > 0 ? (
                <div
                  className="flex flex-col gap-4"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedDeviceId) {
                      handleSelectAndConnectDevice();
                    }
                  }}
                >
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger ref={selectTriggerRef} className="w-full h-16 bg-[#1e1e1e] border-[#2d2d2d] text-lg rounded-xl">
                      <SelectValue placeholder="장치 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] text-white border-[#2d2d2d]">
                        {availableDevicesForSelection.map((id) => (
                          <SelectItem key={id} value={id} className="h-12 focus:bg-blue-600">
                            {getDeviceIcon(id)} {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                  <Button onClick={handleSelectAndConnectDevice} disabled={!selectedDeviceId} className="h-13 mt-4 text-lg font-bold bg-blue-600 hover:bg-blue-500 rounded-xl">
                    연결
                  </Button>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-xl text-center">
                  <p className="text-yellow-500 mb-4 font-medium">모든 장치가 연결되었습니다.</p>
                  <Button onClick={() => {setCurrentActiveGameCode(null); setError(null);}} variant="link" className="text-gray-500 underline">다른 코드로 접속</Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 단계 3: 장치 연결 완료 후 실제 게임 플레이 화면 렌더링 */
          <DeviceGameplay gameState={gameState!} theme={theme!} myDeviceId={myDeviceId} />
        )}
      </main>
    </div>
  );
}