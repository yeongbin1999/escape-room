"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Problem, ProblemType } from "@/types/dbTypes"; 
import { addProblem, updateProblem, getProblemsByTheme } from "@/lib/firestoreService"; 
import { FaUpload, FaTimes, FaSpinner, FaPlus, FaTrash } from "react-icons/fa";
import { // UI 컴포넌트 import (shadcn/ui 기반)
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// 폼 속성 인터페이스 정의
interface ProblemFormProps {
  initialData?: Problem; // 수정 시 기존 데이터
  themeId: string; // 필수: 테마 ID
  onSuccess?: () => void;
  nextProblemNumber?: number; // 신규 문제 번호 (자동 할당)
}

// DB 저장용 데이터 타입 (자동 관리 필드 제외)
type ProblemDataForDB = Omit<Problem, 'createdAt' | 'updatedAt' | 'id'>;

// 1. Zod 스키마 정의
// 미디어(비디오, 이미지, 텍스트, BGM) 필드 스키마
const problemMediaSchema = z.object({
  videoKey: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  bgmKey: z.string().nullable().optional(),
});

// 힌트 배열 내 각 항목 스키마
const hintSchema = z.object({
    value: z.string().min(1, { message: "힌트 내용을 입력하세요." })
});

// 전체 폼 데이터 유효성 검사 스키마
const problemFormSchema = z.object({
  themeId: z.string().min(1, { message: "테마 ID는 필수입니다." }),
  title: z.string().min(1, { message: "문제 제목은 필수입니다." }),
  type: z.enum(["physical", "trigger"], { message: "문제 타입은 필수입니다." }),
  code: z.string().min(1, { message: "문제 코드는 필수입니다." }),
  
  // 힌트: 최소 1개의 항목 필수
  hints: z.array(hintSchema)
      .min(1, { message: "최소 1개의 힌트를 입력해야 합니다." }),
      
  solution: z.string().min(1, { message: "정답은 필수입니다." }),
  media: problemMediaSchema.nullable().optional(),
}).superRefine((data, ctx) => {
  // 2. 타입별 미디어 유효성 검사 (커스텀 유효성 검사)
  if (data.type === "trigger") {
    // 트리거 타입: 미디어 중 최소 1개 필수
    const hasMediaContent = data.media && (
        data.media.videoKey || data.media.imageKey || (data.media.text && data.media.text.trim().length > 0) || data.media.bgmKey
    );
    if (!hasMediaContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "트리거 타입 문제는 비디오/이미지/텍스트/BGM 중 최소 1개의 미디어 콘텐츠가 필요합니다.",
        path: ["type"],
      });
    }
  } else if (data.type === "physical") {
    // 물리 타입: 미디어 가질 수 없음
    if (data.media && (data.media.videoKey || data.media.imageKey || data.media.text || data.media.bgmKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "물리 타입 문제는 미디어를 가질 수 없습니다.",
        path: ["media"],
      });
    }
  }
});

type ProblemFormValues = z.infer<typeof problemFormSchema>;

// 허용되는 파일 타입 및 설명 상수
const ACCEPTED_FILE_TYPES = {
  videoKey: 'video/mp4,video/webm,video/ogg,video/quicktime',
  imageKey: 'image/jpeg,image/png,image/webp,image/gif',
  bgmKey: 'audio/mp3,audio/wav,audio/ogg,audio/mpeg',
};
const ACCEPTED_FILE_DESCRIPTIONS = {
  videoKey: 'MP4, WebM, OGG, MOV 등의 비디오 파일',
  imageKey: 'JPG, PNG, WebP, GIF 등의 이미지 파일',
  bgmKey: 'MP3, WAV, OGG 등의 오디오 파일',
};

export default function ProblemForm({ initialData, themeId, onSuccess, nextProblemNumber }: ProblemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // 현재 업로드 중인 필드 키 저장
  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 3. react-hook-form 설정 및 기본값
  const form = useForm<ProblemFormValues>({
    resolver: zodResolver(problemFormSchema),
    defaultValues: {
      themeId: themeId,
      title: initialData?.title || "",
      type: initialData?.type || "physical",
      code: initialData?.code || "",
      hints: initialData?.hints?.length ? initialData.hints.map(h => ({ value: h })) : [{ value: "" }],
      solution: initialData?.solution || "",
      // 기본값 설정: trigger 타입이면 미디어 객체를 초기화, 아니면 undefined
      media: initialData?.media ?? (initialData?.type === "trigger" ? { videoKey: null, imageKey: null, text: null, bgmKey: null } : undefined),
    },
    mode: "onChange",
  });
  
  // 힌트 목록 동적 관리 (배열)
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hints",
  });

  const problemType = form.watch("type"); // 현재 선택된 문제 타입을 감시

  useEffect(() => {
    form.setValue("themeId", themeId); // themeId가 변경될 경우 폼 값 업데이트
  }, [themeId, form]);

  // 4. 파일 업로드 로직
  const handleFileUpload = async (file: File, fieldName: "videoKey" | "imageKey" | "bgmKey"): Promise<string | null> => {
    // 파일 형식 유효성 검사 (생략된 부분)
    // ...

    setUploading(fieldName); // 업로드 상태 시작
    try {
      // 1. 서버에 Presigned URL 요청
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });
      if (!response.ok) throw new Error('Presigned URL 요청 실패');
      const { signedUrl, key } = await response.json();

      // 2. Presigned URL을 사용하여 파일 업로드 (R2/S3 등)
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('R2 업로드 실패');
      return key; // 저장된 파일 키 반환
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      setDialogMessage(`${file.name} 파일 업로드에 실패했습니다.`);
      setIsDialogOpen(true);
      return null;
    } finally {
      setUploading(null); // 업로드 상태 종료
    }
  };

  // 5. 파일 업로드 UI 컴포넌트
  const FileUploadField = ({ name, label }: { name: "videoKey" | "imageKey" | "bgmKey", label: string }) => {
    const currentKey = form.watch(`media.${name}`);

    return (
      <FormItem>
        <FormLabel className="text-white">{label}</FormLabel>
        <div className="flex items-center space-x-4">
          <FormControl>
            {/* ... (파일 선택 Input 및 Label UI) ... */}
            <div className="relative w-full">
              <Input
                id={`media.${name}`}
                type="file"
                className="hidden"
                accept={ACCEPTED_FILE_TYPES[name]}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file, name).then(key => {
                      if (key) {
                          // 성공 시 폼 값 업데이트
                          const currentMedia = form.getValues("media") || {};
                          form.setValue("media", { ...currentMedia, [name]: key }, { shouldValidate: true, shouldDirty: true });
                      }
                      e.target.value = ''; // Input 초기화
                    });
                  }
                }}
              />
              <label
                htmlFor={`media.${name}`}
                className="flex items-center justify-between cursor-pointer rounded-md border border-[#2d2d2d] bg-[#171717] px-3 py-2 text-sm text-gray-400 focus-visible:border-[#4a4a4a]"
              >
                <span className="truncate max-w-[calc(100%-80px)]">
                  {uploading === name ? `업로드 중...` : (currentKey || "파일을 선택하세요")}
                </span>
                {uploading === name ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              </label>
            </div>
          </FormControl>
          {currentKey && (
            <Button // 파일 제거 버튼
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                 const currentMedia = form.getValues("media") || {};
                 form.setValue("media", { ...currentMedia, [name]: null }, { shouldValidate: true, shouldDirty: true });
              }}
            >
              <FaTimes className="text-red-500" />
            </Button>
          )}
        </div>
        <FormDescription className="text-gray-400 ml-2">{ACCEPTED_FILE_DESCRIPTIONS[name]} (선택 사항)</FormDescription>
        <FormMessage className="text-red-500 pt-1 ml-2" />
      </FormItem>
    );
  };

  // 6. 폼 제출 핸들러
  async function onSubmit(values: ProblemFormValues) {
    setIsSubmitting(true);
    try {
      const existingProblems = await getProblemsByTheme(values.themeId);
      const problemsToCheck = initialData ? existingProblems.filter(p => p.id !== initialData.id) : existingProblems;

      // 문제 코드, 제목, 정답 중복 검사
      const trimmedCode = values.code.trim();
      const trimmedTitle = values.title.trim();
      const trimmedSolution = values.solution.trim();

      if (problemsToCheck.some(p => p.code.trim() === trimmedCode)) {
        setDialogMessage(`이미 존재하는 문제 코드(${trimmedCode})입니다.`); setIsDialogOpen(true); return;
      }
      if (problemsToCheck.some(p => p.title.trim() === trimmedTitle)) {
        setDialogMessage(`이미 존재하는 문제 제목(${trimmedTitle})입니다.`); setIsDialogOpen(true); return;
      }
      if (problemsToCheck.some(p => p.solution.trim() === trimmedSolution)) {
        setDialogMessage(`이미 존재하는 정답(${trimmedSolution})입니다.`); setIsDialogOpen(true); return;
      }

      // 힌트 객체 배열을 string 배열로 변환 및 빈 값 제거
      const hintsArray = values.hints.map(h => h.value.trim()).filter(h => h.length > 0);
        
      // DB 저장을 위한 최종 미디어 객체 정리
      let finalMedia = null;
      if (values.type === "trigger" && values.media) {
          const mediaObject = values.media;
          finalMedia = {
              videoKey: mediaObject.videoKey || null,
              imageKey: mediaObject.imageKey || null,
              text: mediaObject.text?.trim() || null, 
              bgmKey: mediaObject.bgmKey || null,
          };
          // 모든 미디어 필드가 null이면, media 필드 자체를 null로 처리하여 DB에서 제외
          const isMediaEmpty = !finalMedia.videoKey && !finalMedia.imageKey && !finalMedia.text && !finalMedia.bgmKey;
          if (isMediaEmpty) {
              finalMedia = null;
          }
      }

      const dataToSave: ProblemDataForDB = {
          themeId: values.themeId,
          number: initialData?.number || nextProblemNumber || 1, // Dynamically set number
          title: values.title,
          type: values.type as ProblemType,
          code: values.code,
          hints: hintsArray,
          solution: values.solution,
          media: finalMedia, 
      };

      // Firestore에 저장/업데이트
      if (initialData) {
        await updateProblem(values.themeId, initialData.id, dataToSave); 
        setDialogMessage("문제가 성공적으로 업데이트되었습니다.");
      } else {
        await addProblem(values.themeId, dataToSave); 
        setDialogMessage("문제가 성공적으로 생성되었습니다.");
      }

      setIsDialogOpen(true);
    } catch (error) {
      console.error("문제 저장 실패:", error);
      setDialogMessage("문제 저장에 실패했습니다.");
      setIsDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 7. 다이얼로그 닫기 및 성공 시 리디렉션
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    if (dialogMessage.includes("성공")) {
      onSuccess?.();
      router.push(`/admin/${themeId}/problems`);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4">

          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">제목<span className="text-red-500 ml-0">*</span></FormLabel>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          <FormField control={form.control} name="solution" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">정답<span className="text-red-500 ml-0">*</span></FormLabel>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">문제 코드<span className="text-red-500 ml-0">*</span></FormLabel>
              <FormDescription className="text-gray-400 ml-2">이 코드를 입력하면 힌트가 제공됩니다.</FormDescription>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          
          {/* 8. 힌트 목록 (useFieldArray 사용) */}
          <div className="space-y-4">
              <FormLabel className="text-white block">힌트 목록<span className="text-red-500 ml-0">*</span></FormLabel>
              <FormDescription className="text-gray-400 ml-2 mb-4">최소 1개의 힌트를 입력해야 합니다.</FormDescription>
              {fields.map((item, index) => (
                  <FormField
                      key={item.id}
                      control={form.control}
                      name={`hints.${index}.value`}
                      render={({ field }) => (
                          <FormItem className="space-y-2"> 
                              <div className="flex items-start space-x-2"> 
                                <FormLabel className="text-white w-12 pt-2 shrink-0">힌트 {index + 1}</FormLabel>
                                <FormControl className="flex-grow">
                                    <Textarea 
                                        {...field} 
                                        className="bg-[#171717] border-[#2d2d2d] text-white min-h-[50px] max-h-[150px]" 
                                    />
                                </FormControl>
                                <Button // 삭제 버튼 (힌트가 1개 초과일 때만 활성화)
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:bg-[#282828] shrink-0 mt-1"
                                    disabled={fields.length <= 1} 
                                    onClick={() => remove(index)}
                                >
                                    <FaTrash />
                                </Button>
                              </div>
                              {/* 💡 힌트 내용 개별 유효성 검사 메시지 (Textarea 아래에 표시) */}
                              <FormMessage className="text-red-500 ml-[62px]" /> 
                          </FormItem>
                      )}
                  />
              ))}
              {/* 전체 힌트 배열에 대한 유효성 검사 메시지 (최소 1개 요구) */}
              {form.formState.errors.hints && typeof form.formState.errors.hints.message === 'string' && (
                <p className="text-red-500 ml-2 mt-1">{form.formState.errors.hints.message}</p>
              )}
                <div className="flex justify-end pt-2"> 
                  <Button type="button" variant="outline" className="text-white hover:bg-[#282828]" onClick={() => append({ value: "" })}>
                      <FaPlus className="mr-2" /> 힌트 추가
                  </Button>
              </div>
          </div>
          
          {/* 9. 문제 타입 선택 */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">문제 타입<span className="text-red-500 ml-0">*</span></FormLabel>
                <FormDescription className="text-gray-400 ml-2">물리 타입: 미디어 없음, 트리거 타입: 미디어 필수 (최소 1개)</FormDescription>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-[#171717] border-[#2d2d2d] text-white focus:ring-0">
                      <SelectValue placeholder="문제 타입을 선택하세요" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                    <SelectItem value="physical">물리</SelectItem>
                    <SelectItem value="trigger">트리거</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
          
          {/* 10. 미디어 필드 (트리거 타입일 때만 표시) */}
          {problemType === "trigger" && (
            <div className="space-y-6 border p-4 rounded-md bg-[#171717] border-[#2d2d2d]">
              <h3 className="text-lg font-semibold text-white">트리거 타입 문제(트리거 시 노출)</h3>
              <FileUploadField name="videoKey" label="비디오" />
              <FileUploadField name="imageKey" label="이미지" />
              <FormField
                control={form.control}
                name="media.text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">텍스트</FormLabel>
                    <FormControl>
                      <Textarea 
                          {...field} 
                          value={field.value ?? ""} 
                          className="bg-[#171717] border-[#2d2d2d] text-white" 
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400 ml-2">트리거시 표시될 텍스트입니다. (선택 사항)</FormDescription>
                    <FormMessage className="text-red-500 ml-2" />
                  </FormItem>
                )}
              />
              <FileUploadField name="bgmKey" label="배경음악" />
            </div>
          )}

          {/* 11. 저장 버튼 */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || uploading !== null} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              {isSubmitting ? "저장 중..." : (uploading ? "업로드 중..." : "저장")}
            </Button>
          </div>
        </form>
      </Form>

      {/* 12. 결과 다이얼로그 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* ... (다이얼로그 UI) ... */}
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{dialogMessage.includes("실패") || dialogMessage.includes("잘못된") ? "오류" : "성공"}</DialogTitle>
          </DialogHeader>
          <div className="py-4"><p>{dialogMessage}</p></div>
          <DialogFooter>
            <Button onClick={handleDialogClose} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}