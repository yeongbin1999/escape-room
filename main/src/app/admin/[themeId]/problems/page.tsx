"use client";

import { useEffect, useState, useMemo } from "react";
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
import { FaPlus } from "react-icons/fa";
import { IoSearchOutline } from "react-icons/io5";
import { IoIosArrowBack } from "react-icons/io";

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

  const handleConfirmDelete = async () => {
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
  };

  const TableSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell><Skeleton className="h-6 w-10" /></TableCell>
          <TableCell><Skeleton className="h-6 w-48" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-40 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          {/* ⭐ '아이콘 강조형' 돌아가기 버튼과 제목 영역 */}
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin')} 
              className="p-2 h-8 w-8 ml-2 text-gray-400 hover:bg-[#282828] hover:text-white rounded-full flex-shrink-0"
            >
              <IoIosArrowBack className="h-10 w-10" /> 
            </Button>
            
            <h2 className="text-xl font-bold">
              '{theme?.title}' 테마 문제 관리
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
              <TableHead className="text-white">번호</TableHead>
              <TableHead className="text-white">제목</TableHead>
              <TableHead className="text-white">타입</TableHead>
              <TableHead className="text-white">정답</TableHead>
              <TableHead className="text-right text-white">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableSkeleton /> : displayedProblems.map((problem) => (
              <TableRow key={problem.id}>
                <TableCell>{problem.number}</TableCell>
                <TableCell>{problem.title}</TableCell>
                <TableCell>{problem.type}</TableCell>
                <TableCell>{problem.solution}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" className="mr-2 border-gray-700 hover:bg-[#282828]" onClick={() => { setEditingProblem(problem); setShowProblemModal(true); }}>
                    수정
                  </Button>
                  <Button variant="destructive" onClick={() => handleDeleteClick(problem)}>
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
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
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}