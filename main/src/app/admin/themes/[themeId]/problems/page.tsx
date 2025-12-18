"use client";

// --- 라이브러리/훅 임포트 (외부, 내부) ---
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
// UI 컴포넌트 임포트 (Shadcn/UI 기반)
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
// Dnd-kit 임포트 (드래그 앤 드롭)
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors,
  DragEndEvent, DragStartEvent, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 타입 정의 및 서비스 함수 임포트 (Firestore 연동)
import type { Problem, Theme } from "@/types/dbTypes";
import { getProblemsByTheme, deleteProblem, getTheme, updateProblemOrder } from "@/lib/firestoreService";
// 커스텀 컴포넌트 및 훅 임포트
import ProblemForm from "@/components/admin/ProblemForm";
import { useMediaUrl } from "@/lib/useMediaUrl"; // Storage에서 URL을 가져오는 커스텀 훅

// 아이콘 임포트
import { FaPlus, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { IoSearchOutline } from "react-icons/io5";
import { IoIosArrowBack } from "react-icons/io";
import React from "react";


// ====================================================================
// 1. 문제 미디어 표시 컴포넌트 (Problem Media Display Components)
// ====================================================================

/**
 * 문제에 연결된 이미지를 표시합니다.
 * (ThemeImage/Video/Audio와 동일한 로직, 문제 관리용으로 분리됨)
 */
function ProblemImage({ imageKey }: { imageKey: string | null | undefined }) {
  const { url: imageUrl, loading } = useMediaUrl(imageKey);
  if (loading) return <Skeleton className="w-64 h-36" />;
  return (
    <div className="w-64 h-36 bg-gray-800 rounded-md flex items-center justify-center">
      {imageUrl ? (
        <img src={imageUrl} alt="Problem Thumbnail" className="w-full h-full object-cover rounded-md" />
      ) : (
        <span className="text-xs text-gray-400">이미지 없음</span>
      )}
    </div>
  );
}

function ProblemVideo({ videoKey }: { videoKey: string | null | undefined }) {
  const { url: videoUrl, loading } = useMediaUrl(videoKey);
  if (loading) return <Skeleton className="w-64 h-36" />;
  return (
    <div className="w-64 h-36 bg-gray-800 rounded-md flex items-center justify-center">
      {videoUrl ? (
        <video src={videoUrl} controls className="w-full h-full rounded-md bg-black" />
      ) : (
        <span className="text-xs text-gray-400 p-4">비디오 없음</span>
      )}
    </div>
  );
}

function ProblemAudio({ audioKey }: { audioKey: string | null | undefined }) {
  const { url: audioUrl, loading } = useMediaUrl(audioKey);
  if (loading) return <Skeleton className="w-full h-10" />;
  return (
    <div className="w-full max-w-sm">
      {audioUrl ? (
        <audio src={audioUrl} controls className="w-full" />
      ) : (
        <span className="text-xs text-gray-400">BGM 없음</span>
      )}
    </div>
  );
}


// ====================================================================
// 2. 개별 문제 항목 (ProblemItem, Sortable 컴포넌트)
// ====================================================================

interface ProblemItemProps {
  problem: Problem;
  expandedProblemId: string | null;
  toggleExpand: (id: string) => void;
  setEditingProblem: (problem: Problem | undefined) => void;
  setShowProblemModal: (show: boolean) => void;
  handleDeleteClick: (problem: Problem) => void;
  isOrderChangeMode: boolean; // 순서 변경 모드 여부
  originalNumber?: number; // 로컬 순서 변경 전의 원래 순서 번호
}

const ProblemItem: React.FC<ProblemItemProps> = ({
  problem,
  expandedProblemId,
  toggleExpand,
  setEditingProblem,
  setShowProblemModal,
  handleDeleteClick,
  isOrderChangeMode,
  originalNumber,
}) => {
  // Dnd-kit의 useSortable 훅을 사용하여 드래그 가능한 항목으로 만듦
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition 
  } = useSortable({ 
    id: problem.id, 
    // 순서 변경 모드가 아닐 때 드래그 기능을 비활성화
    disabled: !isOrderChangeMode 
  }); 

  // 드래그 시 변환(이동) 및 전환(애니메이션) 스타일 적용
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 순서 변경 모드일 때만 드래그 가능한 커서(grab) 표시
    cursor: isOrderChangeMode ? 'grab' : 'default', 
  };

  const isExpanded = expandedProblemId === problem.id;
  // 현재 번호와 원래 번호가 다를 경우 (순서가 변경된 경우)
  const isNumberChanged = isOrderChangeMode && originalNumber !== undefined && problem.number !== originalNumber;

  return (
    <React.Fragment>
      {/* 문제 테이블 행 (Sortable item) */}
      <TableRow
        ref={setNodeRef} // Dnd-kit을 위한 ref 설정
        style={style}
        {...attributes} // 드래그 가능한 DOM 요소에 필요한 속성
        {...listeners}  // 드래그 시작/이동 이벤트를 처리하는 리스너
        className="touch-action-none" // 모바일 터치 장치에서 스크롤 문제를 방지
      >
        <TableCell className="text-center w-[70px]">
          {/* 순서 번호 표시 및 변경된 경우 강조 */}
          <span className={isNumberChanged ? "text-yellow-400 font-bold" : ""}>
            {problem.number}
          </span>
          {isNumberChanged && (
            <span className="ml-1 text-gray-500 text-xs line-through">({originalNumber})</span> // 원래 순서 번호 표시
          )}
        </TableCell>
        <TableCell className="text-center min-w-[200px]">{problem.title}</TableCell>
        <TableCell className="text-center w-[150px]">{problem.solution}</TableCell>
        <TableCell className="text-center w-[150px]">{problem.code}</TableCell>
        <TableCell className="text-center w-[100px]">{problem.type}</TableCell>
        {/* 수정/삭제 버튼 */}
        <TableCell className="text-right w-[180px]">
          <Button variant="outline" className="mr-2 border-gray-700 hover:bg-[#282828]" onClick={() => { setEditingProblem(problem); setShowProblemModal(true); }}>
            수정
          </Button>
          <Button variant="outline" onClick={() => handleDeleteClick(problem)} className="text-red-400 border-red-700 hover:bg-red-900/50 hover:text-red-300">
            삭제
          </Button>
        </TableCell>
        {/* 상세 보기 확장/축소 버튼 */}
        <TableCell className="text-center w-[50px]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleExpand(problem.id)}
            className="text-gray-400 hover:text-white hover:bg-[#282828]"
          >
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </Button>
        </TableCell>
      </TableRow>
      
      {/* 상세 보기 행 */}
      {isExpanded && (
        <TableRow key={problem.id + "-details"} className="bg-[#2a2a2a] border-b border-slate-700/70">
          <TableCell colSpan={7} className="p-6">
            <div className="flex flex-col space-y-6">
              {/* 문제 타입이 'physical'이 아닐 경우에만 미디어 섹션 표시 */}
              {problem.type !== "physical" && (
                <>
                  {/* 1. 이미지, 영상, BGM 미리보기 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-bold mb-2">🖼️ 이미지:</p>
                      {/* ... ProblemImage 컴포넌트 사용 ... */}
                      <ProblemImage imageKey={problem.media?.imageKey} />
                    </div>
                    <div>
                      <p className="font-bold mb-2">🎥 영상:</p>
                      {/* ... ProblemVideo 컴포넌트 사용 ... */}
                      <ProblemVideo videoKey={problem.media?.videoKey} />
                    </div>
                    <div>
                      <p className="font-bold mb-2">🎵 BGM:</p>
                      {/* ... ProblemAudio 컴포넌트 사용 ... */}
                      <ProblemAudio audioKey={problem.media?.bgmKey} />
                    </div>
                  </div>

                  {/* 2. 문제 텍스트 */}
                  <div className="grid grid-cols-1 gap-6 text-sm">
                    <div>
                      <p className="font-bold mb-2">📝 텍스트:</p>
                      <div className="max-h-40 overflow-y-auto custom-scroll p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                        {problem.media?.text ? (
                          <p className="text-sm whitespace-pre-wrap">
                            {problem.media.text}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">텍스트 내용 없음</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* 3. 힌트 목록 */}
              <div>
                <p className="font-bold mb-2">💡 힌트:</p>
                <div className="max-h-40  overflow-y-auto custom-scroll p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                  {problem.hints && problem.hints.length > 0 ? (
                    <ul className="list-inside space-y-1 text-sm">
                      {problem.hints.map((hint, index) => (
                        <li key={index}>
                          <span className="font-medium mr-3">힌트 {index + 1} :</span>{hint}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic">힌트 없음</p>
                  )}
                </div>
              </div>

              {/* 4. 원격 트리거 목록 (문제 타입이 'trigger'일 경우) */}
              {problem.triggers && problem.triggers.length > 0 && (
                <div className="flex flex-col space-y-4 mt-6">
                  <p className="font-bold text-lg">🚀 원격 트리거 목록:</p>
                  {problem.triggers.map((trigger, index) => (
                    <div key={index} className="p-4 rounded-md bg-[#171717] border border-[#2d2d2d] flex flex-col space-y-4">
                      <p className="font-bold text-base">대상 장치 - {trigger.targetDevice}</p>
                      
                      {/* 트리거 미디어 (이미지, 영상, BGM) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div>
                          <p className="font-bold mb-2">🖼️ 이미지:</p>
                          <ProblemImage imageKey={trigger.mediaState?.imageKey} />
                        </div>
                        <div>
                          <p className="font-bold mb-2">🎥 영상:</p>
                          <ProblemVideo videoKey={trigger.mediaState?.videoKey} />
                        </div>
                        <div>
                          <p className="font-bold mb-2">🎵 BGM:</p>
                          <ProblemAudio audioKey={trigger.mediaState?.bgmKey} />
                        </div>
                      </div>

                      {/* 트리거 텍스트 */}
                      <div className="grid grid-cols-1 gap-6 text-sm">
                        <div>
                          <p className="font-bold mb-2">📝 텍스트:</p>
                          <div className="max-h-40 overflow-y-auto custom-scroll p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                            {trigger.mediaState?.text ? (
                              <p className="text-sm whitespace-pre-wrap">
                                {trigger.mediaState.text}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 italic">텍스트 내용 없음</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
};


// ====================================================================
// 3. 메인 문제 관리 페이지 컴포넌트 (AdminProblemsPage)
// ====================================================================

export default function AdminProblemsPage() {
  const router = useRouter();
  const params = useParams();
  const themeId = params.themeId as string;

  // --- 상태 관리 ---
  const [theme, setTheme] = useState<Theme | null>(null); // 현재 테마 정보
  const [problems, setProblems] = useState<Problem[]>([]); // 현재 화면에 표시되는(순서가 변경될 수 있는) 문제 목록
  const [originalProblems, setOriginalProblems] = useState<Problem[]>([]); // Firestore에서 가져온 원래 순서의 문제 목록
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 모달/알림 상태
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | undefined>(undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);
  const [showOrderChangeNotification, setShowOrderChangeNotification] = useState(false);
  const [orderChangeNotificationTitle, setOrderChangeNotificationTitle] = useState('');
  const [orderChangeNotificationDescription, setOrderChangeNotificationDescription] = useState('');

  // 필터링/정렬 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCriteria, setSortCriteria] = useState('number-asc'); 
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);
  
  // Dnd-kit 상태
  const [activeId, setActiveId] = useState<string | null>(null); // 현재 드래그 중인 아이템 ID
  const [isOrderChangeMode, setIsOrderChangeMode] = useState(false); // 순서 변경 모드 진입 여부
  const [hasPendingChanges, setHasPendingChanges] = useState(false); // 로컬에서 순서가 변경되었는지 여부


  // 상세 정보 확장/축소 토글
  const toggleExpand = (problemId: string) => {
    setExpandedProblemId(prevId => (prevId === problemId ? null : problemId));
  };

  // --- 데이터 불러오기 함수 ---
  const fetchProblemsAndTheme = useCallback(async () => {
    if (!themeId) return;
    setLoading(true);
    setError(null);
    try {
      // 테마 정보와 문제 목록을 병렬로 불러오기
      const [fetchedTheme, fetchedProblems] = await Promise.all([
        getTheme(themeId),
        getProblemsByTheme(themeId)
      ]);
      setTheme(fetchedTheme);
      
      // 순서(number)에 따라 정렬된 문제 목록 저장
      const sortedProblems = fetchedProblems.sort((a, b) => a.number - b.number);
      setProblems(sortedProblems);
      setOriginalProblems(sortedProblems); // 원본 목록 저장
      setHasPendingChanges(false); // 변경 사항 초기화

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [themeId]); 

  // 컴포넌트 마운트 시 데이터 불러오기
  useEffect(() => {
    fetchProblemsAndTheme();
  }, [themeId, fetchProblemsAndTheme]); 

  // --- 삭제 로직 및 순서 재배열 ---
  const handleConfirmDelete = useCallback(async () => {
    if (!problemToDelete) return;
    try {
      await deleteProblem(themeId, problemToDelete.id);
      
      // 삭제 후 나머지 문제들의 순서(number)를 재조정하고 Firestore에 업데이트
      const updatedProblemsAfterDeletion = await getProblemsByTheme(themeId);
      const reSequencedProblems = updatedProblemsAfterDeletion
        .sort((a, b) => a.number - b.number) 
        .map((problem, index) => ({
          id: problem.id,
          number: index + 1, // 1부터 순차적으로 번호 재할당
        }));

      // Firestore에 새로운 순서 업데이트
      if (reSequencedProblems.length > 0) {
        await updateProblemOrder(themeId, reSequencedProblems);
      }
      
      await fetchProblemsAndTheme(); // 전체 데이터 새로고침
      
    } catch (err) {
      console.error("Error deleting problem:", err);
      alert("문제 삭제에 실패했습니다.");
    } finally {
      setShowDeleteConfirm(false);
      setProblemToDelete(null);
    }
  }, [themeId, problemToDelete, fetchProblemsAndTheme]); 

  const handleDeleteClick = (problem: Problem) => {
    setProblemToDelete(problem);
    setShowDeleteConfirm(true);
  };

  // 삭제/알림 모달에서 Enter 키 입력 시 동작 처리 (UX 개선)
  useEffect(() => {
    // ... (삭제/알림 모달 Enter 키 처리 로직)
    if (showDeleteConfirm) {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            event.preventDefault(); 
            handleConfirmDelete();
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => { document.removeEventListener('keydown', handleKeyDown); };
      }
    if (showOrderChangeNotification) {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            event.preventDefault(); 
            setShowOrderChangeNotification(false);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => { document.removeEventListener('keydown', handleKeyDown); };
      }
  }, [showDeleteConfirm, handleConfirmDelete, showOrderChangeNotification]);
  
  // --- Dnd-kit 센서 및 로직 ---
  // 마우스 및 터치 센서 설정 (순서 변경 모드에서만 활성화)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 }, enabled: isOrderChangeMode }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 }, enabled: isOrderChangeMode })
  );

  // 드래그 시작 시 Active ID 설정
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };
  
  // 드래그 종료 시 순서 변경 (로컬 상태만 업데이트)
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProblems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reorderedItems = arrayMove(items, oldIndex, newIndex); // 배열 순서 변경 유틸리티

        // 순서(number) 속성을 새 인덱스(1부터 시작)로 로컬에서 재할당
        const newOrderWithUpdatedNumbers = reorderedItems.map((problem, index) => ({
          ...problem,
          number: index + 1,
        }));
        setHasPendingChanges(true); // 변경 사항이 있음을 표시
        return newOrderWithUpdatedNumbers;
      });
    }
  };


  // --- 검색 및 정렬 필터링 (useMemo) ---
  const displayedProblems = useMemo(() => {
    // 1. 순서(number) 기준으로 정렬된 문제 배열을 복사 (기본 정렬 유지)
    const sortedByNumber = [...problems].sort((a, b) => a.number - b.number);

    // 2. 검색어 필터링
    let filtered = sortedByNumber.filter(p =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 3. 정렬 기준 적용 (number-asc는 기본 정렬이므로 생략 가능)
    if (sortCriteria === 'title-asc') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortCriteria === 'title-desc') {
        filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortCriteria === 'number-desc') {
        filtered.reverse(); // number-asc 정렬된 배열을 뒤집기
    }

    return filtered;
  }, [problems, searchTerm, sortCriteria]);

  // 재정렬 가능 여부 확인 (검색어가 없고, 순서 오름차순 정렬일 때만 가능)
  const isReorderEnabled = useMemo(() => {
    return searchTerm === '' && sortCriteria === 'number-asc';
  }, [searchTerm, sortCriteria]);

  // 새 문제 추가 시 다음 순서 번호 계산
  const nextProblemNumber = useMemo(() => {
    if (problems.length === 0) return 1;
    // 현재 목록에서 가장 큰 number + 1
    return Math.max(...problems.map(p => p.number)) + 1;
  }, [problems]);

  // 로딩 시 스켈레톤 UI 컴포넌트
  const TableSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell className="text-center"><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
          <TableCell className="text-center"><Skeleton className="h-6 w-48 mx-auto" /></TableCell>
          <TableCell className="text-center"><Skeleton className="h-6 w-24 mx-auto" /></TableCell>
          <TableCell className="text-center"><Skeleton className="h-6 w-32 mx-auto" /></TableCell>
          <TableCell className="text-center"><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-40 ml-auto" /></TableCell>
          <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );


  // --- UI/렌더링 ---
  return (
    <div className="p-8">
      {/* 상단 제목 및 액션 버튼 영역 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          {/* 테마 관리 페이지로 돌아가기 버튼 */}
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/themes')} 
              className="p-2 h-8 w-8 ml-2 text-gray-400 hover:bg-[#282828] hover:text-white rounded-full flex-shrink-0"
            >
              <IoIosArrowBack className="h-8 w-8" /> 
            </Button>
            
            <h2 className="text-xl font-bold">
              테마 '{theme?.title || '로딩 중...'}' 문제 관리
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOrderChangeMode ? (
            <>
              {/* 순서 변경 완료 버튼 (Firestore 저장 및 모드 종료) */}
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={async () => {
                  if (hasPendingChanges) {
                    try {
                      // 변경된 문제 ID와 순서(number)만 추출하여 업데이트 요청
                      const problemUpdates = problems.map((problem) => ({
                        id: problem.id,
                        number: problem.number,
                      }));
                      await updateProblemOrder(themeId, problemUpdates); // Firestore 업데이트
                      setHasPendingChanges(false);
                      setOriginalProblems(problems); // 원본 상태도 현재 상태로 업데이트
                      
                      setOrderChangeNotificationTitle("순서 변경 성공");
                      setOrderChangeNotificationDescription("문제 순서가 성공적으로 업데이트되었습니다.");

                    } catch (err) {
                      console.error("Error updating problem order in Firestore:", err);
                      setOrderChangeNotificationTitle("순서 변경 실패");
                      setOrderChangeNotificationDescription("문제 순서 변경에 실패했습니다. 페이지를 새로고침하여 원래 순서로 되돌리세요.");
                      // 실패 시 강제로 데이터 새로고침 (실제 저장된 상태로 되돌림)
                      fetchProblemsAndTheme(); 
                    }
                  } else {
                     setOrderChangeNotificationTitle("변경 사항 없음");
                     setOrderChangeNotificationDescription("순서가 변경되지 않았습니다. 순서 변경 모드를 종료합니다.");
                  }
                  setShowOrderChangeNotification(true);
                  setIsOrderChangeMode(false); // 항상 모드 종료
                }}
              >
                순서 변경 완료
              </Button>
            </>
          ) : (
            <>
              {/* 일반 모드: 검색, 정렬, 추가 버튼 */}
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="제목으로 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-60 bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0 pl-10"
                />
              </div>
              <Select value={sortCriteria} onValueChange={setSortCriteria}>
                <SelectTrigger className="w-[150px] bg-[#171717] border-[#2d2d2d] text-white focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                    <SelectItem value="number-asc">순서 오름차순</SelectItem>
                    <SelectItem value="number-desc">순서 내림차순</SelectItem>
                    <SelectItem value="title-asc">제목 오름차순</SelectItem>
                    <SelectItem value="title-desc">제목 내림차순</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={() => { setEditingProblem(undefined); setShowProblemModal(true); }}
              >
                <FaPlus className="mr-2" />
                문제 추가
              </Button>
              {/* 순서 변경 모드 진입 버튼 (재정렬이 불가능한 상태면 초기화 후 진입) */}
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={() => {
                   if (!isReorderEnabled) {
                    // 순서 변경 모드는 기본 순서 오름차순에서만 의미가 있으므로,
                    // 검색어 제거 및 정렬 기준 초기화
                    setSearchTerm('');
                    setSortCriteria('number-asc');
                  }
                  setIsOrderChangeMode(true);
                }}
              >
                순서 변경
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 문제 목록 테이블 (DndContext로 래핑) */}
      <div className="rounded-md border border-slate-700/70 overflow-auto custom-scroll">
        <DndContext 
          sensors={sensors} // 센서 등록 (마우스/터치)
          collisionDetection={closestCenter} // 충돌 감지 전략
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd} 
          autoScroll={true}
        >
          <Table>
            <TableHeader className="bg-[#111]">
              <TableRow>
                <TableHead className="text-white text-center w-[70px]">순서</TableHead>
                <TableHead className="text-white text-center min-w-[200px]">제목</TableHead>
                <TableHead className="text-white text-center w-[150px]">정답</TableHead>
                <TableHead className="text-white text-center w-[150px]">코드</TableHead>
                <TableHead className="text-white text-center w-[100px]">타입</TableHead>
                <TableHead className="text-right text-white w-[180px]"></TableHead>
                <TableHead className="text-white text-center w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableSkeleton /> : (
                <SortableContext 
                  items={displayedProblems.map(p => p.id)} // 드래그 가능한 아이템 ID 목록
                  strategy={verticalListSortingStrategy} // 수직 목록 정렬 전략
                >
                  {displayedProblems.map((problem) => {
                    // 원본 문제 목록에서 현재 문제 ID와 일치하는 항목을 찾아 원래 순서 번호를 가져옴
                    const originalProblem = originalProblems.find(op => op.id === problem.id);
                    const originalNumber = originalProblem ? originalProblem.number : undefined;

                    return (
                      <ProblemItem
                        key={problem.id}
                        problem={problem}
                        expandedProblemId={expandedProblemId}
                        toggleExpand={toggleExpand}
                        setEditingProblem={setEditingProblem}
                        setShowProblemModal={setShowProblemModal}
                        handleDeleteClick={handleDeleteClick}
                        isOrderChangeMode={isOrderChangeMode} 
                        originalNumber={originalNumber} // 원래 순서 번호 전달
                      />
                    );
                  })}
                </SortableContext>
              )}
            </TableBody>
          </Table>
          
          {/* Drag Overlay: 드래그 시 실제 이동하는 요소 위에 떠서 보이는 요소 */}
          <DragOverlay>
            {activeId ? (
              <div className="bg-[#282828] border border-gray-500 shadow-xl">
                <Table>
                  <TableBody>
                    <ProblemItem
                      // 드래그 중인 아이템 데이터 찾기
                      problem={problems.find(p => p.id === activeId)!}
                      expandedProblemId={null}
                      toggleExpand={() => {}}
                      setEditingProblem={() => {}}
                      setShowProblemModal={() => {}}
                      handleDeleteClick={() => {}}
                      isOrderChangeMode={isOrderChangeMode} // 오버레이에서도 드래그 모드 유지
                    />
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 문제 추가/수정 모달 */}
      <Dialog open={showProblemModal} onOpenChange={setShowProblemModal}>
        <DialogContent className="sm:max-w-[700px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{editingProblem ? "문제 수정" : "새 문제 추가"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto custom-scroll p-1">
            {theme ? ( 
              <ProblemForm
                themeId={themeId}
                initialData={editingProblem}
                availableDevices={["기본장치", ...(theme.availableDevices || [])]} // "기본장치"를 항상 포함
                onSuccess={() => {
                  setShowProblemModal(false);
                  fetchProblemsAndTheme(); // 성공 시 목록 새로고침
                }}
                nextProblemNumber={nextProblemNumber} // 다음 순서 번호 전달
              />
            ) : (
                <div className="flex items-center justify-center h-48">
                    <p className="text-gray-400">테마 정보를 불러오는 중...</p>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* 문제 삭제 확인 모달 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>문제 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 문제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 나머지 문제들의 순서가 자동으로 재조정됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => { 
                setShowDeleteConfirm(false); 
                setProblemToDelete(null); 
              }}
              className="hover:bg-[#282828] hover:text-white border-gray-700"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-red-600 text-white hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 순서 변경 결과 알림 */}
      <AlertDialog open={showOrderChangeNotification} onOpenChange={setShowOrderChangeNotification}>
        <AlertDialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>{orderChangeNotificationTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {orderChangeNotificationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowOrderChangeNotification(false)} className="hover:bg-[#282828] hover:text-white text-white border-1 border-gray-700">
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}