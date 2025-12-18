"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { GameState, Theme, Problem } from "@/types/dbTypes";
import {
  getThemes,
  createNewGameSession,
  updateGameState,
  subscribeToGameSessions,
  reconstructGameStateForJump,
  startGameSession,
  getProblemsByTheme,
  deleteGameSession,
} from "@/lib/firestoreService";
import { FaPlay, FaPause, FaStop, FaRedo, FaExternalLinkAlt, FaCode, FaGamepad, FaSync, FaUsers, FaTrash } from "react-icons/fa";
import { MdOutlineMonitor, MdTablet } from "react-icons/md";
import { QRCodeSVG } from 'qrcode.react';

const generateGameCode = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- Game Session Item Component ---
interface GameSessionItemProps {
  session: GameState;
  themes: Theme[];
  expandedSessionId: string | null;
  toggleExpand: (id: string) => void;
  onUpdateSession: (sessionId: string, data: Partial<GameState>) => Promise<void>;
  onEndSession: (sessionId: string) => void; // 세션 종료 (상태만 변경)
  onDeletePermanently: (sessionId: string) => void; // 세션 영구 삭제
  onResetSessionRequest: (sessionId: string) => void;
  onJumpToProblemRequest: (sessionId: string) => void;
  onResyncTriggers: (sessionId: string) => void;
  onStartGame: (sessionId: string, themeId: string) => void;
  triggerProblemCount: number;
}

const GameSessionItem: React.FC<GameSessionItemProps> = ({
  session,
  themes,
  expandedSessionId,
  toggleExpand,
  onUpdateSession,
  onEndSession, // 이름 변경
  onDeletePermanently, // 추가
  onResetSessionRequest,
  onJumpToProblemRequest,
  onResyncTriggers,
  onStartGame,
  triggerProblemCount,
}) => {
  const theme = themes.find((t) => t.id === session.themeId);
  const isExpanded = expandedSessionId === session.id;

  // --- 추가: 실시간 연결 상태 체크를 위한 상태 ---
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    // 5초마다 현재 시간을 업데이트하여 lastSeen과 비교, 연결 상태를 다시 렌더링
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); 

    return () => clearInterval(timer);
  }, []);

  const allThemeDevices = useMemo(() => ['기본장치', ...(theme?.availableDevices || [])], [theme]);

  const areAllDevicesConnected = useMemo(() => {
    return allThemeDevices.every(deviceId => {
      const device = session.connectedDevices?.[deviceId];
      const lastSeenDate = device?.lastSeen?.toDate();
      const isStale = lastSeenDate ? (currentTime.getTime() - lastSeenDate.getTime()) > 12000 : true;
      return device && (device.status === 'connected' || device.status === 'ready') && !isStale;
    });
  }, [allThemeDevices, session.connectedDevices, currentTime]);

  const getStatusDisplay = (status: GameState['status']) => {
    switch (status) {
      case 'running': return { text: '진행 중', color: 'text-green-500' };
      case 'paused': return { text: '일시 정지', color: 'text-yellow-500' };
      case 'ended': return { text: '클리어', color: 'text-red-500' };
      default: return { text: '대기 중', color: 'text-gray-400' };
    }
  };

  const statusDisplay = getStatusDisplay(session.status);

  const getDeviceIcon = (deviceId: string) => {
    if (deviceId === '기본장치') return <MdOutlineMonitor className="inline mr-1" />;
    if (deviceId.toLowerCase().includes('tablet')) return <MdTablet className="inline mr-1" />;
    return <FaGamepad className="inline mr-1" />;
  };

  const allDeviceLinks = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const baseUrl = `${window.location.origin}/device?gameCode=${session.gameCode}`;
    return allThemeDevices.map(deviceId => ({
      id: deviceId,
      url: `${baseUrl}&deviceId=${encodeURIComponent(deviceId)}`,
    }));
  }, [session.gameCode, allThemeDevices]);

  // 세션 영구 삭제 확인 다이얼로그 상태
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  return (
    <React.Fragment>
      <TableRow className="border-b border-slate-700/70">
        {/* 추가: 삭제 버튼 컬럼 */}
        <TableCell className="text-center w-[50px]">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:bg-[#282828] p-2"
            onClick={() => setShowDeleteConfirmDialog(true)}
            // disabled={session.status !== 'ended'} // 종료된 세션에 대해서만 활성화
          >
            <FaTrash size={16} />
          </Button>
        </TableCell>
        <TableCell className="text-center w-[120px]">{session.gameCode}</TableCell>
        <TableCell className="text-center min-w-[200px]">{theme?.title}</TableCell>
        <TableCell className={`text-center w-[100px] font-bold ${statusDisplay.color}`}>
          {statusDisplay.text}
        </TableCell>
        <TableCell className="text-center w-[100px]">
            {Object.keys(session.solvedProblems || {}).length === triggerProblemCount && triggerProblemCount > 0
                ? '완료'
                : `${session.currentProblemNumber}번`
            }
        </TableCell>
        <TableCell className="text-center w-[150px]">
            {Object.keys(session.solvedProblems || {}).length} / {triggerProblemCount}
        </TableCell>
        <TableCell className="text-center w-[150px]">
            {Object.values(session.connectedDevices || {}).filter(d => {
                const lastSeenDate = d?.lastSeen?.toDate();
                const isStale = lastSeenDate ? (currentTime.getTime() - lastSeenDate.getTime()) > 10000 : true;
                return (d.status === 'connected' || d.status === 'ready') && !isStale;
            }).length} / {allThemeDevices.length}
        </TableCell>
        <TableCell className="text-right w-[120px] space-x-2">
            <Button
                variant="outline"
                size="sm"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={() => toggleExpand(session.id)}
            >
                {isExpanded ? '닫기' : '상세'}
            </Button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-[#2a2a2a] border-b border-slate-700/70">
          <TableCell colSpan={8} className="p-6"> {/* colSpan 7 -> 8로 변경 */}
            <div className="flex flex-col space-y-6">
              {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-bold mb-2">세션 ID:</p>
                  <Input value={session.id} readOnly className="bg-[#171717] border-[#2d2d2d] text-white" />
                </div>
                <div>
                  <p className="font-bold mb-2">게임 코드:</p>
                  <Input value={session.gameCode} readOnly className="bg-[#171717] border-[#2d2d2d] text-white" />
                </div>
              </div> */}

              <div className="w-full p-4 border rounded-md border-[#333] bg-[#1a1a1a] flex flex-col">
                <p className="font-bold mb-4 text-sm border-b border-[#333] pb-2">장치 관리 (연결 상태 & QR 코드)</p>
                <div className="flex-grow grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 w-full">
                  {allThemeDevices.map((deviceId) => {
                    const device = session.connectedDevices?.[deviceId];
                    
                    // --- 수정: 연결 상태 판별 로직 ---
                    const lastSeenDate = device?.lastSeen?.toDate();
                    const isStale = lastSeenDate ? (currentTime.getTime() - lastSeenDate.getTime()) > 10000 : true;
                    const isConnected = device && (device.status === 'connected' || device.status === 'ready') && !isStale;
                    // ---------------------------------

                    const deviceLink = allDeviceLinks.find(link => link.id === deviceId);

                    return (
                      <div key={deviceId} className="flex flex-col items-center p-2 border border-slate-700 rounded bg-[#2a2a2a]">
                        <span className="text-[10px] font-medium mb-1 truncate w-full text-center text-gray-300 flex items-center justify-center">
                          {getDeviceIcon(deviceId)} <span className="ml-1">{deviceId}</span>
                        </span>
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded mb-2 ${isConnected ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                          {isConnected ? 'ON' : 'OFF'}
                        </span>
                        {deviceLink && (
                          <>
                            <div className="bg-white p-1 rounded shadow-sm mb-1">
                              <QRCodeSVG 
                                value={deviceLink.url} 
                                size={100} 
                                level="M" 
                                fgColor="#000000" 
                                bgColor="#FFFFFF" 
                              />
                            </div>
                            <a 
                              href={deviceLink.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-400 hover:text-blue-300 text-[9px] flex items-center"
                            >
                              OPEN <FaExternalLinkAlt className="ml-1 w-2 h-2" />
                            </a>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-6 justify-center">
                {session.status === 'pending' && (
                  <Button 
                    onClick={() => onStartGame(session.id, session.themeId)} 
                    disabled={!areAllDevicesConnected}
                  >
                    <FaPlay className="mr-2" /> 시작
                  </Button>
                )}
                {session.status === 'running' && (
                  <Button onClick={() => onUpdateSession(session.id, { status: 'paused' })} disabled={session.status !== 'running'}>
                    <FaPause className="mr-2" /> 중단
                  </Button>
                )}
                {session.status === 'paused' && (
                  <Button onClick={() => onUpdateSession(session.id, { status: 'running' })} disabled={session.status !== 'paused'}>
                    <FaPlay className="mr-2" /> 재개
                  </Button>
                )}
                {session.status === 'ended' && (
                  <Button 
                    onClick={() => onStartGame(session.id, session.themeId)} 
                    disabled
                  >
                    <FaPlay className="mr-2" /> 시작
                  </Button>
                )}
                {/* <Button onClick={() => onEndSession(session.id)}>
                  <FaStop className="mr-2" /> 종료
                </Button> */}
                <Button onClick={() => onResetSessionRequest(session.id)}>
                  <FaRedo className="mr-2" /> 리셋
                </Button>
                <Button onClick={() => onJumpToProblemRequest(session.id)}>
                  <FaCode className="mr-2" /> 시점 이동
                </Button>
                {/* <Button onClick={() => onResyncTriggers(session.id)}>
                  <FaSync className="mr-2" /> 장치 재동기화
                </Button> */}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* 추가: 세션 영구 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent className="bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>세션 영구 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 게임 세션을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmDialog(false)}>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowDeleteConfirmDialog(false);
                onDeletePermanently(session.id); // 영구 삭제 함수 호출
              }} 
              className="bg-red-600 hover:bg-red-700"
            >
              영구 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>
  );
};

export default function AdminGameSessionsPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [gameSessions, setGameSessions] = useState<GameState[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [newSessionId, setNewSessionId] = useState('');
  const [newSessionGameCode, setNewSessionGameCode] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const [sessionToResetId, setSessionToResetId] = useState<string | null>(null);
  const [showDeletePermanentlyConfirmDialog, setShowDeletePermanentlyConfirmDialog] = useState(false); // New state for delete confirmation
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null); // New state to hold ID of session to delete
  const [showJumpToProblemDialog, setShowJumpToProblemDialog] = useState(false);
  const [sessionToJumpId, setSessionToJumpId] = useState<string | null>(null);
  const [problemNumberToJump, setProblemNumberToJump] = useState<string>('');
  const [triggerProblems, setTriggerProblems] = useState<Problem[]>([]);
  const [dialogMessage, setDialogMessage] = useState<string>('');
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState<boolean>(false);
  const [triggerProblemCounts, setTriggerProblemCounts] = useState<Record<string, number>>({});
  
  // *** 수정된 토글 핸들러 ***
  const handleToggleExpand = useCallback((sessionId: string) => {
    setExpandedSessionId((prevId) => (prevId === sessionId ? null : sessionId));
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const fetchedThemes = await getThemes();
            // 활성화된 테마만 필터링
            const activeThemes = fetchedThemes.filter(theme => theme.isActive);
            setThemes(activeThemes);

            if (activeThemes.length > 0) {
                setSelectedThemeId(prevId => prevId ?? activeThemes[0].id);
                const counts: Record<string, number> = {};
                const problemPromises = activeThemes.map(async (theme) => {
                    const problems = await getProblemsByTheme(theme.id);
                    counts[theme.id] = problems.filter(p => p.type === 'trigger').length;
                });
                await Promise.all(problemPromises);
                setTriggerProblemCounts(counts);
            }
        } catch (err) {
            console.error("Error fetching initial data:", err);
        }
    };
    
    fetchInitialData();

    const unsubscribe = subscribeToGameSessions((latestSessions) => {
        setGameSessions(latestSessions);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateSession = async () => {
    if (!selectedThemeId) return;
    const generatedCode = generateGameCode();
    try {
      const sessionId = await createNewGameSession(selectedThemeId, generatedCode);
      setNewSessionId(sessionId);
      setNewSessionGameCode(generatedCode);
      setShowCreateSessionDialog(true);
    } catch (err) {
      setDialogMessage("새 게임 세션 생성에 실패했습니다.");
      setIsAlertDialogOpen(true);
    }
  };

  const handleStartGame = useCallback(async (sessionId: string, themeId: string) => {
    try {
      await startGameSession(sessionId, themeId);
      setDialogMessage("게임이 시작되었습니다.");
      setIsAlertDialogOpen(true);
    } catch (err) {
      setDialogMessage(`게임 시작에 실패했습니다: ${(err as Error).message}`);
      setIsAlertDialogOpen(true);
    }
  }, []);

  const handleUpdateSession = useCallback(async (sessionId: string, data: Partial<GameState>) => {
    try {
      await updateGameState(sessionId, data);
    } catch (err) {
      setDialogMessage("세션 상태 업데이트에 실패했습니다.");
      setIsAlertDialogOpen(true);
    }
  }, []);

  const handleEndSession = useCallback(async (sessionId: string) => {
    try {
        await updateGameState(sessionId, { status: 'ended' });
        setDialogMessage("세션이 종료 상태로 변경되었습니다.");
        setIsAlertDialogOpen(true);
    } catch (err) {
        setDialogMessage("세션 종료에 실패했습니다.");
        setIsAlertDialogOpen(true);
    }
  }, []);

  const handleDeletePermanently = useCallback(async (sessionId: string) => {
    try {
        await deleteGameSession(sessionId);
        setDialogMessage("세션이 영구적으로 삭제되었습니다.");
        setIsAlertDialogOpen(true);
    } catch (err) {
        setDialogMessage("세션 삭제에 실패했습니다.");
        setIsAlertDialogOpen(true);
    } finally {
        if (expandedSessionId === sessionId) {
          setExpandedSessionId(null);
        }
    }
  }, [expandedSessionId]);
  
  const handleResetSession = useCallback(async () => {
    if (!sessionToResetId) return;
    const currentSession = gameSessions.find(s => s.id === sessionToResetId);
    if (!currentSession) return;

    try {
      const reconstructedData = await reconstructGameStateForJump(sessionToResetId, 1, currentSession.themeId);
      await updateGameState(sessionToResetId, { ...reconstructedData, status: 'pending' });
      setDialogMessage("세션이 성공적으로 리셋되었습니다.");
      setIsAlertDialogOpen(true);
    } catch (err) {
      setDialogMessage("세션 리셋에 실패했습니다.");
      setIsAlertDialogOpen(true);
    } finally {
      setShowResetConfirmDialog(false);
      setSessionToResetId(null);
    }
  }, [sessionToResetId, gameSessions]);

  const handleJumpToProblem = useCallback(async () => {
    if (!sessionToJumpId) return;
    const currentSession = gameSessions.find(s => s.id === sessionToJumpId);
    if (!currentSession) return;
    
    let targetProblemNum: number;
    let newStatus: GameState['status'];
    if (problemNumberToJump === 'all_solved') {
        const problems = await getProblemsByTheme(currentSession.themeId);
        // Correctly get the highest numbered trigger problem
        const lastTrigger = problems.filter(p => p.type === 'trigger').sort((a, b) => a.number - b.number)[problems.filter(p => p.type === 'trigger').length - 1];
        targetProblemNum = lastTrigger ? lastTrigger.number + 1 : 1;
        newStatus = 'ended'; // Set status to ended for all_solved
    } else {
        targetProblemNum = parseInt(problemNumberToJump, 10);
        newStatus = 'running'; // For specific problem jumps, resume running
    }

    try {
      const reconstructedData = await reconstructGameStateForJump(sessionToJumpId, targetProblemNum, currentSession.themeId);
      await updateGameState(sessionToJumpId, { ...reconstructedData, status: newStatus });
      setDialogMessage("지정한 위치로 이동했습니다.");
      setIsAlertDialogOpen(true);
    } catch (err) {
      setDialogMessage("문제 이동에 실패했습니다.");
      setIsAlertDialogOpen(true);
    } finally {
      setShowJumpToProblemDialog(false);
      setSessionToJumpId(null);
    }
  }, [sessionToJumpId, problemNumberToJump, gameSessions]);
  
  const handleResyncTriggers = useCallback(async (sessionId: string) => {
    const session = gameSessions.find(s => s.id === sessionId);
    if (!session) return;
    try {
        const reconstructedData = await reconstructGameStateForJump(sessionId, session.currentProblemNumber, session.themeId);
        await updateGameState(sessionId, { ...reconstructedData, status: session.status });
        setDialogMessage("장치들이 재동기화되었습니다.");
        setIsAlertDialogOpen(true);
    } catch (err) {
        setDialogMessage("트리거 재동기화에 실패했습니다.");
        setIsAlertDialogOpen(true);
    }
  }, [gameSessions]);

  // 다이얼로그 요청 핸들러
  const onResetSessionRequest = (sessionId: string) => {
    setSessionToResetId(sessionId);
    setShowResetConfirmDialog(true);
  };

  const handleDeletePermanentlyRequest = (sessionId: string) => {
    setSessionToDeleteId(sessionId);
    setShowDeletePermanentlyConfirmDialog(true);
  };

  const onJumpToProblemRequest = async (sessionId: string) => {
    setSessionToJumpId(sessionId);
    const currentSession = gameSessions.find(s => s.id === sessionId);
    if (currentSession) {
        const problems = await getProblemsByTheme(currentSession.themeId);
        setTriggerProblems(problems.filter(p => p.type === 'trigger').sort((a, b) => a.number - b.number));
    }
    setShowJumpToProblemDialog(true);
  };

  const displayedSessions = useMemo(() => {
    return gameSessions
                       .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [gameSessions]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">게임 관리</h2>

      <Card className="mb-6 bg-[#1f1f1f] border-slate-700/70 text-white">
        <CardHeader>
          <CardTitle>새 게임 세션 시작</CardTitle>
          <CardDescription className="text-gray-400">새 게임 세션을 생성합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-end md:flex-row gap-4 items-center">
          <Select value={selectedThemeId ?? ''} onValueChange={setSelectedThemeId}>
            <SelectTrigger className="w-full md:w-full bg-[#171717] border-[#2d2d2d] text-white focus:ring-0">
              <SelectValue placeholder="테마 선택" />
            </SelectTrigger>
            <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
              {themes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>{theme.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateSession} variant="outline" disabled={!selectedThemeId} className="w-full md:w-auto">
            <FaPlay className="mr-2" /> 새 세션 시작
          </Button>
        </CardContent>
      </Card>

      <h3 className="text-xl font-bold mb-4">활성 세션 목록</h3>
      <div className="rounded-md border border-slate-700/70 overflow-auto mb-8">
        <Table>
          <TableHeader className="bg-[#111]">
            <TableRow>
              {/* 추가: 삭제 버튼 헤더 */}
              <TableHead className="text-white text-center w-[50px]"></TableHead>
              <TableHead className="text-white text-center w-[120px]">게임 코드</TableHead>
              <TableHead className="text-white text-center min-w-[300px]">테마</TableHead>
              <TableHead className="text-white text-center w-[150px]">상태</TableHead>
              <TableHead className="text-white text-center w-[150px]">진행중인 문제</TableHead>
              <TableHead className="text-white text-center w-[150px]">진행도</TableHead>
              <TableHead className="text-white text-center w-[150px]">장치 연결</TableHead>
              <TableHead className="text-white text-right w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-8"> {/* colSpan 7 -> 8로 변경 */}
                  활성 게임 세션이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              displayedSessions.map((session) => (
                <GameSessionItem
                  key={session.id}
                  session={session}
                  themes={themes}
                  expandedSessionId={expandedSessionId}
                  toggleExpand={handleToggleExpand}
                  onUpdateSession={handleUpdateSession}
                  onEndSession={handleEndSession}
                  onDeletePermanently={handleDeletePermanentlyRequest}
                  onResetSessionRequest={onResetSessionRequest}
                  onJumpToProblemRequest={onJumpToProblemRequest}
                  onResyncTriggers={handleResyncTriggers}
                  onStartGame={handleStartGame}
                  triggerProblemCount={triggerProblemCounts[session.themeId] || 0}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 나머지 Dialog 및 AlertDialog 컴포넌트들... (동일) */}
      <Dialog open={showCreateSessionDialog} onOpenChange={setShowCreateSessionDialog}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>새 게임 세션 생성 완료</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-center">
            <p className="text-lg">게임 코드: <span className="font-bold text-green-400 text-xl">{newSessionGameCode}</span></p>
            <div className="flex justify-center">
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/device?gameCode=${newSessionGameCode}`} size={128} level="H" includeMargin={true} fgColor="#FFFFFF" bgColor="#1f1f1f" />
            </div>
            <p className="text-sm text-gray-400">장치에서 이 QR 코드를 스캔하세요.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCreateSessionDialog(false)} variant="outline">확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <AlertDialogContent className="bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>게임 세션 리셋 확인</AlertDialogTitle>
            <AlertDialogDescription>세션의 모든 진행 상황이 초기화됩니다. 계속하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSessionToResetId(null)}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSession} className="bg-red-600">리셋</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 추가: 세션 영구 삭제 최종 확인 다이얼로그 */}
      <AlertDialog open={showDeletePermanentlyConfirmDialog} onOpenChange={setShowDeletePermanentlyConfirmDialog}>
        <AlertDialogContent className="bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>세션 영구 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 게임 세션({sessionToDeleteId})을 영구적으로 삭제하시겠습니까?
              이 작업은 되돌릴 수 없으며, 모든 데이터가 손실됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeletePermanentlyConfirmDialog(false); setSessionToDeleteId(null); }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowDeletePermanentlyConfirmDialog(false);
                if (sessionToDeleteId) handleDeletePermanently(sessionToDeleteId);
                setSessionToDeleteId(null);
              }} 
              className="bg-red-600 hover:bg-red-700"
            >
              영구 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showJumpToProblemDialog} onOpenChange={setShowJumpToProblemDialog}>
        <DialogContent className="sm:max-w-[475px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>시점 이동</DialogTitle>
            <DialogDescription className="text-gray-400">
              선택한 문제를 풀어야하는 시점으로 이동합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={problemNumberToJump} onValueChange={setProblemNumberToJump}>
              <SelectTrigger className="w-full bg-[#171717] border-[#2d2d2d] text-white">
                <SelectValue placeholder="이동할 문제 선택" />
              </SelectTrigger>
              <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                {triggerProblems.map((p) => (
                  <SelectItem key={p.id} value={String(p.number)}>
                    {p.number}번 '{p.title}'
                  </SelectItem>
                ))}
                <SelectItem value="all_solved">엔딩 (모든 문제 해결)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowJumpToProblemDialog(false)}>
              취소
            </Button>
            <Button onClick={handleJumpToProblem} className="bg-blue-600 hover:bg-blue-700" disabled={!problemNumberToJump}>
              이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <AlertDialogContent className="bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>알림</AlertDialogTitle>
            <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsAlertDialogOpen(false)} className="bg-blue-600">확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}