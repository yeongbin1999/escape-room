"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { Problem, Theme } from "@/types/dbTypes";
import { getProblemsByTheme, deleteProblem, getTheme, updateProblemOrder } from "@/lib/firestoreService";
import ProblemForm from "@/components/admin/ProblemForm";
import { FaPlus, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { IoSearchOutline } from "react-icons/io5";
import { IoIosArrowBack } from "react-icons/io";
import { useMediaUrl } from "@/lib/useMediaUrl";
import React from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";



// --- Problem Media Display Components (문제 미디어 표시 컴포넌트) ---
/**
 * 문제에 연결된 이미지를 표시합니다.
 * @param imageKey 미디어 서버에 저장된 이미지 키
 */
function ProblemImage({ imageKey }: { imageKey: string | null | undefined }) {
  // 커스텀 훅을 사용하여 미디어 키로부터 접근 가능한 URL을 가져옵니다.
  const imageUrl = useMediaUrl(imageKey);

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

/**
 * 문제에 연결된 비디오를 표시합니다.
 * @param videoKey 미디어 서버에 저장된 비디오 키
 */
function ProblemVideo({ videoKey }: { videoKey: string | null | undefined }) {
  const videoUrl = useMediaUrl(videoKey);

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

/**
 * 문제에 연결된 배경 음악(BGM) 오디오를 표시합니다.
 * @param audioKey 미디어 서버에 저장된 오디오 키
 */
function ProblemAudio({ audioKey }: { audioKey: string | null | undefined }) {
  const audioUrl = useMediaUrl(audioKey);

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

// --- ProblemItem Component (개별 문제 테이블 행 및 상세 보기) ---
interface ProblemItemProps {
  problem: Problem;
  expandedProblemId: string | null;
  toggleExpand: (id: string) => void;
  setEditingProblem: (problem: Problem | undefined) => void;
  setShowProblemModal: (show: boolean) => void;
  handleDeleteClick: (problem: Problem) => void;
  isOrderChangeMode: boolean; // 순서 변경 모드 여부 (드래그 활성화/비활성화)
  originalNumber?: number; // The problem's original number before local reordering
}

const ProblemItem: React.FC<ProblemItemProps> = ({
  problem,
  expandedProblemId,
  toggleExpand,
  setEditingProblem,
  setShowProblemModal,
  handleDeleteClick,
  isOrderChangeMode,
  originalNumber, // Destructure originalNumber
}) => {
  // Dnd-kit의 useSortable 훅 사용
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition 
  } = useSortable({ 
    id: problem.id, 
    // 순서 변경 모드가 아닐 때 드래그 비활성화
    disabled: !isOrderChangeMode 
  }); 

  // 드래그 시 스타일 (변환 및 전환 효과)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 순서 변경 모드일 때만 'grab' 커서 표시
    cursor: isOrderChangeMode ? 'grab' : 'default', 
  };

  const isExpanded = expandedProblemId === problem.id;

  const isNumberChanged = isOrderChangeMode && originalNumber !== undefined && problem.number !== originalNumber;

  return (
    <React.Fragment>
      {/* 문제 테이블 행 (Sortable item) */}
      <TableRow
        ref={setNodeRef} // Dnd-kit을 위한 ref 설정
        style={style}
        {...attributes} // 드래그 핸들 외의 드래그 속성
        {...listeners}  // 드래그 시작 및 이동 리스너
        className="touch-action-none" // 터치 디바이스 호환성 개선
      >
        <TableCell className="text-center w-[70px]">
          <span className={isNumberChanged ? "text-yellow-400" : ""}>
            {problem.number}
          </span>
          {isNumberChanged && (
            <span className="ml-1 text-gray-500 text-xs">({originalNumber})</span>
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
              {/* 물리적(physical) 타입이 아닐 경우 미디어 섹션 표시 */}
              {problem.type !== "physical" && (
                <>
                  {/* 1. 이미지, 영상, BGM */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    {/* 이미지 */}
                    <div>
                      <p className="font-bold mb-2">🖼️ 이미지:</p>
                      {problem.media?.imageKey ? (
                        <ProblemImage imageKey={problem.media.imageKey} />
                      ) : (
                        <div className="w-64 h-36 bg-gray-800/50 rounded-md flex items-center justify-center border border-dashed border-gray-700">
                          <span className="text-sm text-gray-500">이미지 없음</span>
                        </div>
                      )}
                    </div>
                    {/* 영상 */}
                    <div>
                      <p className="font-bold mb-2">🎥 영상:</p>
                      {problem.media?.videoKey ? (
                        <ProblemVideo videoKey={problem.media.videoKey} />
                      ) : (
                        <div className="w-64 h-36 bg-gray-800/50 rounded-md flex items-center justify-center border border-dashed border-gray-700">
                          <span className="text-sm text-gray-500">영상 없음</span>
                        </div>
                      )}
                    </div>
                    {/* BGM/오디오 */}
                    <div>
                      <p className="font-bold mb-2">🎵 BGM:</p>
                      {problem.media?.bgmKey ? (
                        <ProblemAudio audioKey={problem.media.bgmKey} />
                      ) : (
                        <div className="w-full max-w-sm h-10 bg-gray-800/50 rounded-md flex items-center justify-center border border-dashed border-gray-700">
                          <span className="text-sm text-gray-500">BGM 없음</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. 텍스트 */}
                  <div className="grid grid-cols-1 gap-6 text-sm">
                    <div>
                      <p className="font-bold mb-2">📝 텍스트:</p>
                      <div className="max-h-40 overflow-y-auto custom-scroll p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                        {problem.media?.text ? (
                          <p className="text-sm whitespace-pre-wrap">
                            {problem.media.text}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            텍스트 내용 없음
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* 3. 힌트 */}
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
                    <p className="text-sm text-gray-500 italic">
                      힌트 없음
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
};


// --- AdminProblemsPage Component (메인 문제 관리 페이지) ---
export default function AdminProblemsPage() {
  const router = useRouter();
  const params = useParams();
  const themeId = params.themeId as string;

  // --- 상태 관리 ---
  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [originalProblems, setOriginalProblems] = useState<Problem[]>([]); // New state to store original order
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 문제 추가/수정 모달 관련
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | undefined>(undefined);
  
  // 문제 삭제 확인 모달 관련
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);

  // 순서 변경 알림 관련
  const [showOrderChangeNotification, setShowOrderChangeNotification] = useState(false);
  const [orderChangeNotificationTitle, setOrderChangeNotificationTitle] = useState('');
  const [orderChangeNotificationDescription, setOrderChangeNotificationDescription] = useState('');

  // 검색/정렬/확장 관련
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCriteria, setSortCriteria] = useState('number-asc'); 
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);
  
  // Dnd-kit 드래그 앤 드롭 관련
  const [activeId, setActiveId] = useState<string | null>(null); 
  const [isOrderChangeMode, setIsOrderChangeMode] = useState(false); 
  const [hasPendingChanges, setHasPendingChanges] = useState(false); 


  const toggleExpand = (problemId: string) => {
    setExpandedProblemId(prevId => (prevId === problemId ? null : problemId));
  };

  // --- 데이터 불러오기 ---
  const fetchProblemsAndTheme = async () => {
    if (!themeId) return;
    setLoading(true);
    setError(null);
    try {
      const [fetchedTheme, fetchedProblems] = await Promise.all([
        getTheme(themeId),
        getProblemsByTheme(themeId)
      ]);
      setTheme(fetchedTheme);
      // 순서(number)에 따라 정렬된 상태로 저장
      const sortedProblems = fetchedProblems.sort((a, b) => a.number - b.number);
      setProblems(sortedProblems);
      setOriginalProblems(sortedProblems); // Store original order
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblemsAndTheme();
  }, [themeId]);

  // --- 삭제 로직 ---
  const handleConfirmDelete = useCallback(async () => {
    if (!problemToDelete) return;
    try {
      await deleteProblem(themeId, problemToDelete.id);
      setProblems(prev => prev.filter(p => p.id !== problemToDelete.id));
    } catch (err) {
      console.error("Error deleting problem:", err);
      alert("문제 삭제에 실패했습니다.");
    } finally {
      setShowDeleteConfirm(false);
      setProblemToDelete(null);
    }
  }, [themeId, problemToDelete]);

  const handleDeleteClick = (problem: Problem) => {
    setProblemToDelete(problem);
    setShowDeleteConfirm(true);
  };

  // 삭제 확인 모달에서 Enter 키로 삭제 실행 (UX 개선)
  useEffect(() => {
    if (showDeleteConfirm) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault(); 
          handleConfirmDelete();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showDeleteConfirm, handleConfirmDelete]);

  // 순서 변경 알림 모달에서 Enter 키로 확인 실행 (UX 개선)
  useEffect(() => {
    if (showOrderChangeNotification) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault(); 
          setShowOrderChangeNotification(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showOrderChangeNotification]);
  
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
        const reorderedItems = arrayMove(items, oldIndex, newIndex);

        // 순서(number) 속성을 새 인덱스(1부터 시작)로 로컬에서 업데이트
        const newOrderWithUpdatedNumbers = reorderedItems.map((problem, index) => ({
          ...problem,
          number: index + 1,
        }));
        setHasPendingChanges(true); // 변경 사항이 있음을 표시
        return newOrderWithUpdatedNumbers;
      });
    }
  };


  // --- 검색 및 정렬 필터링 ---
  const displayedProblems = useMemo(() => {
    // 1. 기본적으로 'number' 순으로 정렬된 문제 배열 복사
    const sortedByNumber = [...problems].sort((a, b) => a.number - b.number);

    // 2. 검색어 필터링
    let filtered = sortedByNumber.filter(p =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 3. 정렬 기준 적용
    if (sortCriteria === 'title-asc') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortCriteria === 'title-desc') {
        filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortCriteria === 'number-desc') {
        filtered.reverse(); // number-asc 정렬된 배열을 반전
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
    return Math.max(...problems.map(p => p.number)) + 1;
  }, [problems]);

  // 로딩 시 스켈레톤 UI
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
          {/* '아이콘 강조형' 돌아가기 버튼과 제목 영역 */}
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin')} 
              className="p-2 h-8 w-8 ml-2 text-gray-400 hover:bg-[#282828] hover:text-white rounded-full flex-shrink-0"
            >
              <IoIosArrowBack className="h-8 w-8" /> 
            </Button>
            
            <h2 className="text-xl font-bold">
              테마 '{theme?.title}' 문제 관리
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOrderChangeMode ? (
            <>
              {/* 순서 변경 완료 버튼 (저장 및 모드 종료) */}
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={async () => {
                  if (hasPendingChanges) {
                    try {
                      const problemUpdates = problems.map((problem) => ({
                        id: problem.id,
                        number: problem.number,
                      }));
                      await updateProblemOrder(themeId, problemUpdates);
                      setHasPendingChanges(false);
                      setOriginalProblems(problems); // Update original problems to current state
                      
                      setOrderChangeNotificationTitle("순서 변경 성공");
                      setOrderChangeNotificationDescription("문제 순서가 성공적으로 업데이트되었습니다.");
                      setShowOrderChangeNotification(true);

                    } catch (err) {
                      console.error("Error updating problem order in Firestore:", err);
                      
                      setOrderChangeNotificationTitle("순서 변경 실패");
                      setOrderChangeNotificationDescription("문제 순서 변경에 실패했습니다. 페이지를 새로고침해주세요.");
                      setShowOrderChangeNotification(true);
                      fetchProblemsAndTheme(); // Re-fetch to revert to actual saved state
                    }
                  }
                  setIsOrderChangeMode(false); // Always exit mode
                }}
              >
                순서 변경 완료
              </Button>
            </>
          ) : (
            <>
              {/* 검색 입력 필드 */}
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="제목으로 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-60 bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0 pl-10"
                />
              </div>
              {/* 정렬 기준 선택 */}
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
              {/* 문제 추가 버튼 */}
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={() => { setEditingProblem(undefined); setShowProblemModal(true); }}
              >
                <FaPlus className="mr-2" />
                문제 추가
              </Button>
              {/* 순서 변경 모드 진입 버튼 */}
              <Button
                variant="outline"
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                onClick={() => {
                   if (!isReorderEnabled) {
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} autoScroll={true}>
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
                  items={displayedProblems.map(p => p.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  {displayedProblems.map((problem) => {
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
                        originalNumber={originalNumber}
                      />
                    );
                  })}
                </SortableContext>
              )}
            </TableBody>
          </Table>
          
          {/* 드래그 오버레이 */}
          <DragOverlay>
            {activeId ? (
              <div className="bg-[#282828] border border-gray-500">
                <Table>
                  <TableBody>
                    <ProblemItem
                      problem={problems.find(p => p.id === activeId)!}
                      expandedProblemId={null}
                      toggleExpand={() => {}}
                      setEditingProblem={() => {}}
                      setShowProblemModal={() => {}}
                      handleDeleteClick={() => {}}
                      isOrderChangeMode={isOrderChangeMode} 
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
            <ProblemForm
              themeId={themeId}
              initialData={editingProblem}
              onSuccess={() => {
                setShowProblemModal(false);
                fetchProblemsAndTheme();
              }}
              nextProblemNumber={nextProblemNumber}
            />
          </div>
        </DialogContent>
      </Dialog>

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