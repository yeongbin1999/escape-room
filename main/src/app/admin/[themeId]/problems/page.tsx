"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Problem, getProblemsByTheme, deleteProblem, getTheme } from "@/lib/firestoreService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProblemForm from "@/components/admin/ProblemForm";

export default function AdminThemeProblemsPage() {
  const { themeId } = useParams();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [themeTitle, setThemeTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | undefined>(undefined);

  const fetchProblemsAndTheme = useCallback(async () => {
    if (!themeId || typeof themeId !== 'string') {
      setError("유효하지 않은 테마 ID입니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fetchedTheme = await getTheme(themeId);
      if (fetchedTheme) {
        setThemeTitle(fetchedTheme.title);
      } else {
        setError("테마를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const fetchedProblems = await getProblemsByTheme(themeId);
      setProblems(fetchedProblems);
    } catch (err) {
      console.error("Error fetching problems or theme:", err);
      setError("문제 또는 테마 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [themeId, setLoading, setError, setThemeTitle, setProblems]);

  useEffect(() => {
    fetchProblemsAndTheme();
  }, [fetchProblemsAndTheme]);

  const handleDelete = async (problemId: string) => {
    if (!themeId || typeof themeId !== 'string') {
      alert("유효하지 않은 테마 ID입니다.");
      return;
    }
    if (confirm("정말로 이 문제를 삭제하시겠습니까?")) {
      try {
        await deleteProblem(themeId, problemId);
        fetchProblemsAndTheme(); // Re-fetch problems after deletion
      } catch (err) {
        console.error("Error deleting problem:", err);
        alert("문제 삭제에 실패했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white p-8 flex items-center justify-center">
        <p>문제 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-white p-8 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between p-4 bg-black shadow-md">
        <Link href="/admin">
          <h1 className="text-2xl font-extrabold tracking-widest cursor-pointer">ESCAPE ROOM</h1>
        </Link>
      </nav>

      <main className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{themeTitle} 테마 문제 관리</h2>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => { setEditingProblem(undefined); setShowProblemModal(true); }}
          >
            새 문제 생성
          </Button>
        </div>

        {problems.length === 0 ? (
          <p>등록된 문제가 없습니다.</p>
        ) : (
          <div className="rounded-md border border-slate-700/70 overflow-hidden">
            <Table>
              <TableHeader className="bg-[#111]">
                <TableRow>
                  <TableHead className="text-white">번호</TableHead>
                  <TableHead className="text-white">제목</TableHead>
                  <TableHead className="text-white">타입</TableHead>
                  <TableHead className="text-white">정답</TableHead>
                  <TableHead className="text-white">생성일</TableHead>
                  <TableHead className="text-white">수정일</TableHead>
                  <TableHead className="text-right text-white">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.map((problem) => (
                  <TableRow key={problem.id} className="hover:bg-[#2a2a2a]">
                    <TableCell className="font-medium">{problem.number}</TableCell>
                    <TableCell>{problem.title}</TableCell>
                    <TableCell>{problem.type}</TableCell>
                    <TableCell>{problem.solution}</TableCell>
                    <TableCell>{problem.createdAt.toDate().toLocaleString()}</TableCell>
                    <TableCell>{problem.updatedAt.toDate().toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        className="text-blue-400 hover:text-blue-300"
                        onClick={() => { setEditingProblem(problem); setShowProblemModal(true); }}
                      >
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 ml-2"
                        onClick={() => handleDelete(problem.id)}
                      >
                        삭제
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={showProblemModal} onOpenChange={setShowProblemModal}>
        <DialogContent className="sm:max-w-[600px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{editingProblem ? "문제 수정" : "새 문제 생성"}</DialogTitle>
          </DialogHeader>
          <ProblemForm
            initialData={editingProblem}
            themeId={themeId as string}
            onSuccess={() => {
              setShowProblemModal(false);
              fetchProblemsAndTheme();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
