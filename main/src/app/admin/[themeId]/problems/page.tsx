// AdminProblemsPage.tsx
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
import { getProblemsByTheme, deleteProblem, getTheme } from "@/lib/firestoreService";
import ProblemForm from "@/components/admin/ProblemForm";
import { FaPlus, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { IoSearchOutline } from "react-icons/io5";
import { IoIosArrowBack } from "react-icons/io";
import { useMediaUrl } from "@/lib/useMediaUrl";
import React from "react";

export default function AdminProblemsPage() {
  const router = useRouter();
  const params = useParams();
  const themeId = params.themeId as string;

  const [theme, setTheme] = useState<Theme | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | undefined>(undefined);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<Problem | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortCriteria, setSortCriteria] = useState('number-asc');
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(null);

  const toggleExpand = (problemId: string) => {
    setExpandedProblemId(prevId => (prevId === problemId ? null : problemId));
  };

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
      setProblems(fetchedProblems);
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

  // handleConfirmDelete 함수를 useCallback으로 정의
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

  // Enter 키 이벤트 리스너 추가 (삭제 확인 모달)
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
  // -----------------------------------------------------

  const displayedProblems = useMemo(() => {
    let filtered = problems.filter(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortCriteria) {
      case 'number-asc':
        filtered.sort((a, b) => a.number - b.number);
        break;
      case 'number-desc':
        filtered.sort((a, b) => b.number - a.number);
        break;
      case 'title-asc':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        break;
    }
    return filtered;
  }, [problems, searchTerm, sortCriteria]);

  const handleDeleteClick = (problem: Problem) => {
    setProblemToDelete(problem);
    setShowDeleteConfirm(true);
  };

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

  // --- Media Display Components for Problem ---
  function ProblemImage({ imageKey }: { imageKey: string | null | undefined }) {
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

  return (
    <div className="p-8">
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
              <SelectItem value="number-asc">번호 오름차순</SelectItem>
              <SelectItem value="number-desc">번호 내림차순</SelectItem>
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
        </div>
      </div>

      <div className="rounded-md border border-slate-700/70 overflow-auto custom-scroll">
        <Table>
          <TableHeader className="bg-[#111]">
            <TableRow>
              <TableHead className="text-white text-center w-[70px]">번호</TableHead>
              <TableHead className="text-white text-center min-w-[200px]">제목</TableHead>
              <TableHead className="text-white text-center w-[150px]">정답</TableHead>
              <TableHead className="text-white text-center w-[150px]">코드</TableHead>
              <TableHead className="text-white text-center w-[100px]">타입</TableHead>
              <TableHead className="text-right text-white w-[180px]"></TableHead>
              <TableHead className="text-white text-center w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableSkeleton /> : displayedProblems.map((problem) => (
              <React.Fragment key={problem.id}>
                <TableRow>
                  {/* 중앙 정렬 적용 (text-center) */}
                  <TableCell className="text-center">{problem.number}</TableCell>
                  <TableCell className="text-center">{problem.title}</TableCell>
                  <TableCell className="text-center">{problem.solution}</TableCell>
                  <TableCell className="text-center">{problem.code}</TableCell>
                  <TableCell className="text-center">{problem.type}</TableCell>
                  {/* 액션 버튼은 오른쪽 정렬 유지 (text-right) */}
                  <TableCell className="text-right">
                    <Button variant="outline" className="mr-2 border-gray-700 hover:bg-[#282828]" onClick={() => { setEditingProblem(problem); setShowProblemModal(true); }}>
                      수정
                    </Button>
                    <Button variant="outline" onClick={() => handleDeleteClick(problem)} className="text-red-400 border-red-700 hover:bg-red-900/50 hover:text-red-300">
                      삭제
                    </Button>
                  </TableCell>
                  {/* 확장 버튼은 중앙 정렬 유지 (text-center) */}
                  <TableCell className="text-center w-[50px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(problem.id)}
                      className="text-gray-400 hover:text-white hover:bg-[#282828]"
                    >
                      {expandedProblemId === problem.id ? <FaChevronUp /> : <FaChevronDown />}
                    </Button>
                  </TableCell>
                </TableRow>
                
                {/* 확장된 상세 정보 (없음 항목 표시 로직 추가) */}
                {expandedProblemId === problem.id && (
                  <TableRow key={problem.id + "-details"} className="bg-[#2a2a2a] border-b border-slate-700/70">
                    <TableCell colSpan={7} className="p-6">
                      <div className="flex flex-col space-y-6">
                        
                        {/* 1. 이미지 및 영상 (첫째 줄) */}
                        {/* 키가 없더라도 컨테이너를 렌더링하여 구조를 유지 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
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
                        </div>

                        {/* 2. BGM 및 텍스트 (둘째 줄) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
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
                          {/* 텍스트 */}
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

                        {/* 3. 힌트 (셋째 줄) */}
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
            ))}
          </TableBody>
        </Table>
      </div>

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
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>문제 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 문제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} className="hover:bg-[#282828] hover:text-white text-white border-gray-700">
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}