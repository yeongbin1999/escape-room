"use client";

import { useEffect, useState, useMemo } from "react";
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
import { FaCheck, FaTimes, FaChevronDown, FaChevronUp, FaPlus } from "react-icons/fa";
import React from "react";
import { useMediaUrl } from "@/lib/useMediaUrl";
import { Input } from "@/components/ui/input";
import { IoSearchOutline } from "react-icons/io5";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

import Image from 'next/image';

// --- Media Display Components ---

function ThemeImage({ imageKey }: { imageKey: string | null | undefined }) {
  const { url: mediaUrl, loading } = useMediaUrl(imageKey);
  const imageUrl = mediaUrl || '/image.png';

  if (loading) {
    return <Skeleton className="w-64 h-36" />;
  }

  return (
    <div className="relative w-64 h-36 bg-gray-800 rounded-md overflow-hidden">
      <Image
        src={imageUrl}
        alt={imageKey ? "Theme Thumbnail" : "Default Image"}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        style={{ objectFit: 'cover' }}
        className="transition-transform duration-300 hover:scale-105"
      />
    </div>
  );
}

function ThemeVideo({ videoKey }: { videoKey: string | null | undefined }) {
  const { url: videoUrl, loading } = useMediaUrl(videoKey);

  if (loading) {
    return <Skeleton className="w-64 h-36" />;
  }

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
  const { url: audioUrl, loading } = useMediaUrl(audioKey);

  if (loading) {
    return <Skeleton className="w-full h-10" />;
  }

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

const TableSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-12" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-48 ml-auto" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );


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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCriteria, setSortCriteria] = useState('createdAt-desc');

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

  const displayedThemes = useMemo(() => {
    let filtered = themes.filter(theme => 
      theme.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortCriteria) {
      case 'createdAt-desc':
        filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        break;
      case 'updatedAt-desc':
        filtered.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
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
    <div className="p-8">
      {error ? (
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <>
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
                  <SelectItem value="title-asc">제목 오름차순</SelectItem>
                  <SelectItem value="title-desc">제목 내림차순</SelectItem>
                  <SelectItem value="updatedAt-desc">최근 수정순</SelectItem>
                  <SelectItem value="createdAt-desc">최신 생성순</SelectItem>
                  <SelectItem value="createdAt-asc">오래된 순</SelectItem>
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
                  <TableHead className="text-white text-center">오프닝 이미지</TableHead>
                  <TableHead className="text-white text-center">오프닝 텍스트</TableHead>
                  <TableHead className="text-white text-center w-[100px]">문제 수</TableHead>
                  <TableHead className="text-white text-center">생성일</TableHead>
                  <TableHead className="text-white text-center">수정일</TableHead>
                  <TableHead className="text-white text-center">활성화</TableHead>
                  <TableHead className="text-white text-center"></TableHead>
                  <TableHead className="text-white text-center w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableSkeleton /> : displayedThemes.map((theme) => (
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
                      <TableCell className="text-center">
                        {theme.openingImageKey ? <FaCheck className="text-green-500 mx-auto" /> : <FaTimes className="text-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {theme.openingText ? <FaCheck className="text-green-500 mx-auto" /> : <FaTimes className="text-red-500 mx-auto" />}
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
                        <Link href={`/admin/themes/${theme.id}/problems`}>
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
                        <TableCell colSpan={11} className="p-6">
                          <div className="flex flex-col space-y-6">
                            {/* First Section: All Media (Thumbnail, Opening Image, Opening Video, Opening BGM) */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                                {/* Thumbnail (Main Image) */}
                                <div>
                                    <p className="font-bold mb-2">메인 이미지:</p>
                                    <ThemeImage imageKey={theme.thumbnailKey} />
                                </div>
                                {/* Opening Image */}
                                <div>
                                    <p className="font-bold mb-2">오프닝 이미지:</p>
                                    {theme.openingImageKey ? (
                                      <ThemeImage imageKey={theme.openingImageKey} />
                                    ) : (
                                      <div className="w-64 h-36 bg-gray-800/50 rounded-md flex items-center justify-center border border-dashed border-gray-700">
                                        <span className="text-sm text-gray-500">이미지 없음</span>
                                      </div>
                                    )}
                                </div>
                                {/* Opening Video */}
                                <div>
                                    <p className="font-bold mb-2">오프닝 영상:</p>
                                    <ThemeVideo videoKey={theme.openingVideoKey} />
                                </div>
                                {/* Opening BGM */}
                                <div>
                                    <p className="font-bold mb-2">오프닝 BGM:</p>
                                    <ThemeAudio audioKey={theme.openingBgmKey} />
                                </div>
                            </div>

                            {/* Second Section: Textual Content (Description, Opening Text) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                {/* Description */}
                                <div>
                                    <p className="font-bold mb-2">설명:</p>
                                    <p className="text-sm p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                                        {theme.description || '없음'}
                                    </p>
                                </div>
                                {/* Opening Text */}
                                <div>
                                    <p className="font-bold mb-2">오프닝 텍스트:</p>
                                    <p className="text-sm p-3 rounded-md whitespace-pre-wrap bg-[#171717] border border-[#2d2d2d]">
                                        {theme.openingText || '없음'}
                                    </p>
                                </div>
                            </div>

                            {/* Third Section: Available Devices */}
                            <div>
                                <p className="font-bold mb-2">사용 장치 목록:</p>
                                {theme.availableDevices && theme.availableDevices.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full">기본장치 (항상 포함)</span>
                                        {theme.availableDevices.map((device, index) => (
                                            <span key={index} className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                                {device}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full">기본장치 (항상 포함)</span>
                                )}
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