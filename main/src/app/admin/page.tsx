"use client";

import { useEffect, useState, useMemo } from "react";
import { FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { app } from "@/lib/firebaseConfig";
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
import type { Theme } from "@/types/dbTypes";
import { getThemes, deleteTheme, updateTheme, getProblemCountByTheme } from "@/lib/firestoreService";
import ThemeForm from "@/components/admin/ThemeForm";
import { Switch } from "@/components/ui/switch";
import TruncatedTextWithTooltip from "@/components/ui/TruncatedTextWithTooltip";
import { FaCheck, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
import React from "react";
import { RiAdminFill } from "react-icons/ri";
import { useMediaUrl } from "@/lib/useMediaUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IoSearchOutline } from "react-icons/io5";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Media Display Components ---

function ThemeImage({ imageKey }: { imageKey: string | null | undefined }) {
  const imageUrl = useMediaUrl(imageKey);

  return (
    <div className="w-64 h-36 bg-gray-800 rounded-md flex items-center justify-center">
      {imageUrl ? (
        <img src={imageUrl} alt="Theme Thumbnail" className="w-full h-full object-cover rounded-md" />
      ) : (
        <span className="text-xs text-gray-400">이미지 없음</span>
      )}
    </div>
  );
}

function ThemeVideo({ videoKey }: { videoKey: string | null | undefined }) {
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

function ThemeAudio({ audioKey }: { audioKey: string | null | undefined }) {
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


export default function AdminThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | undefined>(undefined);
  const [problemCounts, setProblemCounts] = useState<{ [themeId: string]: number }>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [themeToDeleteId, setThemeToDeleteId] = useState<string | null>(null);
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth(app);

  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>('');
  
  // 1. 검색과 정렬을 위한 state 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCriteria, setSortCriteria] = useState('createdAt-desc');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentAdminEmail(user.email || '관리자');
      } else {
        setCurrentAdminEmail('');
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  };


  const fetchThemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedThemes = await getThemes();
      setThemes(fetchedThemes);

      const counts: { [themeId: string]: number } = {};
      for (const theme of fetchedThemes) {
        counts[theme.id] = await getProblemCountByTheme(theme.id);
      }
      setProblemCounts(counts);

    } catch (err) {
      console.error("Error fetching themes:", err);
      setError("테마를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  // 2. 검색과 정렬 로직 적용
  const displayedThemes = useMemo(() => {
    let filtered = themes.filter(theme => 
      theme.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortCriteria) {
      case 'createdAt-desc':
        filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        break;
      case 'createdAt-asc':
        filtered.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
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
  }, [themes, searchTerm, sortCriteria]);

  const handleDelete = (id: string) => {
    setThemeToDeleteId(id);
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (themeToDeleteId) {
      try {
        await deleteTheme(themeToDeleteId);
        setThemes((prevThemes) => prevThemes.filter((theme) => theme.id !== themeToDeleteId));
        setShowDeleteConfirmModal(false);
        setThemeToDeleteId(null);
      } catch (err) {
        console.error("Error deleting theme:", err);
        alert("테마 삭제에 실패했습니다.");
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setThemeToDeleteId(null);
  };

  const handleToggleActive = async (themeId: string, isActive: boolean) => {
    try {
      await updateTheme(themeId, { isActive });
      setThemes((prevThemes) =>
        prevThemes.map((theme) =>
          theme.id === themeId ? { ...theme, isActive } : theme
        )
      );
    } catch (err) {
      console.error("Error updating theme active status:", err);
      alert("테마 활성화 상태 업데이트에 실패했습니다.");
    }
  };

  const toggleExpand = (themeId: string) => {
    setExpandedThemeId(prevId => (prevId === themeId ? null : themeId));
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <nav className="flex items-center justify-between p-4 bg-black shadow-md">
        <Link href="/admin">
          <h1 className="text-2xl inline font-extrabold tracking-widest cursor-pointer">ESCAPE ROOM</h1>
          <span className="text-sm text-gray-400 ml-2">admin</span>
        </Link>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="rounded-full h-10 w-10 p-0 text-white hover:bg-[#282828] border-gray-700"
            >
              <RiAdminFill className="h-8 w-8" />
              <span className="sr-only">관리자 메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#1f1f1f] text-white border-slate-700/70 mr-4">
            <DropdownMenuLabel className="truncate">{currentAdminEmail}</DropdownMenuLabel> 
            <DropdownMenuSeparator className="bg-slate-700/70" />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="cursor-pointer text-red-400 hover:bg-slate-700/70"
            >
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <main className="p-8">
        
        {loading ? (
          <div className="flex items-center justify-center h-[calc(100vh-80px)]"> 
            <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            로딩중
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[calc(100vh-80px)]">
            <p className="text-red-500">{error}</p>
          </div>
        ) : (
          <>
            {/* 3. 검색 및 정렬 UI 추가 */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">테마 관리</h2>
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
                    <SelectItem value="createdAt-desc">최신 생성순</SelectItem>
                    <SelectItem value="createdAt-asc">오래된 순</SelectItem>
                    <SelectItem value="title-asc">제목 오름차순</SelectItem>
                    <SelectItem value="title-desc">제목 내림차순</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                  onClick={() => { setEditingTheme(undefined); setShowThemeModal(true); }}
                >
                  <FaPlus className="mr-2" />
                  테마 추가
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-slate-700/70 overflow-auto custom-scroll">
              <Table>
                <TableHeader className="bg-[#111]">
                  <TableRow>
                    <TableHead className="text-white text-center min-w-[300px]">제목</TableHead>
                    <TableHead className="text-white text-center">오프닝 영상</TableHead>
                    <TableHead className="text-white text-center">오프닝 음악</TableHead>
                    <TableHead className="text-white text-center w-[100px]">문제 수</TableHead>
                    <TableHead className="text-white text-center">생성일</TableHead>
                    <TableHead className="text-white text-center">수정일</TableHead>
                    <TableHead className="text-white text-center">활성화</TableHead>
                    <TableHead className="text-white text-center"></TableHead>
                    <TableHead className="text-white text-center w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 4. displayedThemes를 사용하여 테이블 렌더링 */}
                  {displayedThemes.map((theme) => (
                    <React.Fragment key={theme.id}>
                      <TableRow>
                        <TableCell className="min-w-[400px] max-w-[400px]">
                          <TruncatedTextWithTooltip text={theme.title} maxWidthClass="max-w-[400px]" />
                        </TableCell>
                        <TableCell className="text-center">
                          {theme.openingVideoKey ? <FaCheck className="text-green-500 mx-auto" /> : <FaTimes className="text-red-500 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {theme.openingBgmKey ? <FaCheck className="text-green-500 mx-auto" /> : <FaTimes className="text-red-500 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center w-[100px]">
                          {problemCounts[theme.id] !== undefined ? problemCounts[theme.id] : '...'}
                        </TableCell>
                        <TableCell className="text-center">{theme.createdAt.toDate().toLocaleString()}</TableCell>
                        <TableCell className="text-center">{theme.updatedAt.toDate().toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={theme.isActive}
                            onCheckedChange={(checked) => handleToggleActive(theme.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right flex justify-end space-x-2">
                          <Link href={`/admin/${theme.id}/problems`}>
                            <Button 
                              variant="outline" 
                              className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                            >
                              문제 관리
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                            onClick={() => { setEditingTheme(theme); setShowThemeModal(true); }}
                          >
                            수정
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-400 border-red-700 hover:bg-red-900/50 hover:text-red-300"
                            onClick={() => handleDelete(theme.id)} 
                          >
                            삭제
                          </Button>
                        </TableCell>
                        <TableCell className="text-center w-[50px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(theme.id)}
                            className="text-gray-400 hover:text-white hover:bg-[#282828]"
                          >
                            {expandedThemeId === theme.id ? <FaChevronUp /> : <FaChevronDown />}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedThemeId === theme.id && (
                        <TableRow key={theme.id + "-details"} className="bg-[#2a2a2a] border-b border-slate-700/70">
                          <TableCell colSpan={9} className="p-6">
                            <div className="flex flex-col space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                <div>
                                  <p className="font-bold mb-2">메인 이미지:</p>
                                  <ThemeImage imageKey={theme.thumbnailKey} />
                                </div>
                                <div>
                                  <p className="font-bold mb-2">오프닝 영상:</p>
                                  <ThemeVideo videoKey={theme.openingVideoKey} />
                                </div>
                                <div>
                                  <p className="font-bold mb-2">오프닝 BGM:</p>
                                  <ThemeAudio audioKey={theme.openingBgmKey} />
                                </div>
                              </div>
                              <div>
                                <p className="font-bold mb-2">설명:</p>
                                <p className="text-sm p-3 rounded-md whitespace-pre-wrap">
                                  {theme.description || '없음'}
                                </p>
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
          </>
        )}
      </main>

      <Dialog open={showThemeModal} onOpenChange={setShowThemeModal}>
        <DialogContent className="sm:max-w-[700px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{editingTheme ? "테마 수정" : "새 테마 추가"}</DialogTitle>
          </DialogHeader>
          <ThemeForm
            initialData={editingTheme}
            onSuccess={() => {
              setShowThemeModal(false);
              fetchThemes();
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <AlertDialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <AlertDialogHeader>
            <AlertDialogTitle>테마 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 테마를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDelete} 
              className="hover:bg-[#282828] hover:text-white text-white border-gray-700"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              autoFocus 
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
