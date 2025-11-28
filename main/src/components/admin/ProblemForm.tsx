// ProblemForm.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form"; // useFieldArray 추가
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
// Problem 타입 정의를 사용하기 위해 import
import type { Problem, ProblemType } from "@/types/dbTypes"; 
// firestoreService의 실제 시그니처에 맞춥니다.
import { addProblem, updateProblem } from "@/lib/firestoreService"; 
import { FaUpload, FaTimes, FaSpinner, FaPlus, FaTrash } from "react-icons/fa"; // 아이콘 추가
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ProblemFormProps {
  initialData?: Problem;
  themeId: string;
  onSuccess?: () => void;
}

// Problem 타입에서 DB가 자동 관리하는 필드를 제외한 데이터 타입
type ProblemDataForDB = Omit<Problem, 'createdAt' | 'updatedAt' | 'id'>;

const problemMediaSchema = z.object({
  videoKey: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  bgmKey: z.string().nullable().optional(),
});

const hintSchema = z.object({
    value: z.string().min(1, { message: "힌트 내용을 입력하세요." })
});

const problemFormSchema = z.object({
  themeId: z.string().min(1, { message: "테마 ID는 필수입니다." }),
  number: z.string()
    .min(1, { message: "문제 번호는 양수여야 합니다." })
    .refine(val => !isNaN(Number(val)) && Number(val) > 0, { 
      message: "문제 번호는 양수여야 합니다." 
    }),
  title: z.string().min(1, { message: "문제 제목은 필수입니다." }),
  type: z.enum(["physical", "trigger"], { message: "문제 타입은 필수입니다." }),
  code: z.string().min(1, { message: "문제 코드는 필수입니다." }),
  
  // 👇️ 수정된 부분: 힌트 배열을 필수로 변경하고 최소 1개의 항목을 요구합니다.
  hints: z.array(hintSchema)
      .min(1, { message: "최소 1개의 힌트를 입력해야 합니다." }),
      
  solution: z.string().min(1, { message: "정답은 필수입니다." }),
  media: problemMediaSchema.nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "trigger") {
    if (!data.media) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "트리거 타입 문제는 미디어 정보가 필요합니다.",
        path: ["media"],
      });
    }
  } else if (data.type === "physical") {
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

export default function ProblemForm({ initialData, themeId, onSuccess }: ProblemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<ProblemFormValues>({
    resolver: zodResolver(problemFormSchema),
    defaultValues: {
      themeId: themeId,
      number: String(initialData?.number || 1), 
      title: initialData?.title || "",
      type: initialData?.type || "physical",
      code: initialData?.code || "",
      // 힌트가 없으면 기본값으로 빈 힌트 하나를 넣어 최소 1개 항목을 충족시킵니다.
      hints: initialData?.hints?.length ? initialData.hints.map(h => ({ value: h })) : [{ value: "" }],
      solution: initialData?.solution || "",
      media: initialData?.media ?? (initialData?.type === "trigger" ? { videoKey: null, imageKey: null, text: null, bgmKey: null } : undefined),
    },
    mode: "onChange",
  });
  
  // ⚠️ useFieldArray 훅 사용
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hints",
  });

  const problemType = form.watch("type");

  useEffect(() => {
    form.setValue("themeId", themeId);
  }, [themeId, form]);

  // handleFileUpload 함수 (생략)
  const handleFileUpload = async (file: File, fieldName: "videoKey" | "imageKey" | "bgmKey"): Promise<string | null> => {
    const acceptedTypes = ACCEPTED_FILE_TYPES[fieldName];
    if (file.type && acceptedTypes && !acceptedTypes.split(',').includes(file.type)) {
      const allowedExtensions = ACCEPTED_FILE_DESCRIPTIONS[fieldName];
      setDialogMessage(`잘못된 파일 형식입니다. ${allowedExtensions}만 업로드할 수 있습니다.`);
      setIsDialogOpen(true);
      return null;
    }

    setUploading(fieldName);
    try {
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!response.ok) throw new Error('Presigned URL 요청 실패');
      const { signedUrl, key } = await response.json();

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('R2 업로드 실패');
      return key;
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      setDialogMessage(`${file.name} 파일 업로드에 실패했습니다.`);
      setIsDialogOpen(true);
      return null;
    } finally {
      setUploading(null);
    }
  };

  // FileUploadField 컴포넌트 (생략)
  const FileUploadField = ({ name, label }: { name: "videoKey" | "imageKey" | "bgmKey", label: string }) => {
    const currentKey = form.watch(`media.${name}`);
    const acceptAttr = ACCEPTED_FILE_TYPES[name];
    const uiDescription = ACCEPTED_FILE_DESCRIPTIONS[name];

    return (
      <FormItem>
        <FormLabel className="text-white">{label}</FormLabel>
        <div className="flex items-center space-x-4">
          <FormControl>
            <div className="relative w-full">
              <Input
                id={`media.${name}`}
                type="file"
                className="hidden"
                accept={acceptAttr}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file, name).then(key => {
                      if (key) {
                          const currentMedia = form.getValues("media") || {};
                          form.setValue("media", { ...currentMedia, [name]: key }, { shouldValidate: true, shouldDirty: true });
                      }
                      e.target.value = '';
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
            <Button
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
        <FormDescription className="text-gray-400 ml-2">{uiDescription} (선택 사항)</FormDescription>
        <FormMessage className="text-red-500 pt-1 ml-2" />
      </FormItem>
    );
  };

  async function onSubmit(values: ProblemFormValues) {
    setIsSubmitting(true);
    try {
      // ⚠️ 수정된 부분: hints 객체 배열을 string 배열로 변환하고 빈 값 제거
      // Zod 스키마에서 최소 1개를 요구하더라도, 내용이 빈 문자열인 힌트는 DB에 저장하지 않기 위해 필터링합니다.
      const hintsArray = values.hints
        ? values.hints.map(h => h.value.trim()).filter(h => h.length > 0)
        : [];
        
      // 만약 hintsArray가 비어있다면 (즉, 유일한 힌트 필드가 비어 있었다면), Zod 검사에서 걸러지므로 
      // 이 로직은 주로 DB에 저장될 깨끗한 데이터만 남기는 역할을 합니다.

      const dataToSave: ProblemDataForDB = {
          themeId: values.themeId,
          number: Number(values.number),
          title: values.title,
          type: values.type as ProblemType,
          code: values.code,
          hints: hintsArray, // 변환된 배열 사용
          solution: values.solution,
          media: values.type === "physical" ? null : (values.media || { videoKey: null, imageKey: null, text: null, bgmKey: null }),
      };

      if (initialData) {
        // updateProblem 시그니처: (themeId, problemId, problemData)
        await updateProblem(values.themeId, initialData.id, dataToSave); 
        setDialogMessage("문제가 성공적으로 업데이트되었습니다.");
      } else {
        // addProblem 시그니처: (themeId, problemData)
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
          {/* 1. 문제 번호 */}
          <FormField
            control={form.control}
            name="number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center">
                    문제 번호<span className="text-red-500 ml-0">*</span>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input type="number" placeholder="문제 번호" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
          
          {/* 2. 문제 제목 */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center">
                    문제 제목<span className="text-red-500 ml-0">*</span>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="문제 제목" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 3. 정답 (순서 변경) */}
          <FormField
            control={form.control}
            name="solution"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center">
                    정답<span className="text-red-500 ml-0">*</span>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="문제 정답" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 4. 문제 코드 (순서 변경) */}
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center">
                    문제 코드<span className="text-red-500 ml-0">*</span>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="문제 코드" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormDescription className="text-gray-400 ml-2">
                  이 코드를 입력하면 힌트가 제공됩니다.
                </FormDescription>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
          
          {/* 5. 힌트 목록 (순서 변경) */}
          <div className="space-y-4">
              <FormLabel className="text-white block">
                  <span className="flex items-center">
                      힌트 목록<span className="text-red-500 ml-0">*</span> {/* 필수 항목 표시 */}
                  </span>
              </FormLabel>
              <FormDescription className="text-gray-400 ml-2 mb-4">
                  최소 1개의 힌트를 입력해야 합니다. 각 힌트 내용을 입력하세요.
              </FormDescription>
              {fields.map((item, index) => (
                  <FormField
                      key={item.id}
                      control={form.control}
                      name={`hints.${index}.value`} // 필드 이름이 객체 배열 형태를 따름
                      render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                              <FormLabel className="text-white w-12 pt-2">
                                  힌트 {index + 1}
                              </FormLabel>
                              <FormControl className="flex-grow">
                                  <Textarea 
                                      placeholder={`힌트 ${index + 1} 내용을 입력하세요.`} 
                                      {...field} 
                                      className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0 min-h-[50px] max-h-[150px]" 
                                  />
                              </FormControl>
                              <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:bg-[#282828]"
                                  // 최소 1개는 남겨야 하므로, 힌트가 1개 초과일 때만 삭제 버튼 활성화
                                  disabled={fields.length <= 1} 
                                  onClick={() => remove(index)}
                              >
                                  <FaTrash />
                              </Button>
                              <FormMessage className="text-red-500 ml-2 absolute left-[120px] top-[40px]" />
                          </FormItem>
                      )}
                  />
              ))}
              {/* 힌트 배열 전체에 대한 에러 메시지 (최소 1개 요구 사항) */}
              {form.formState.errors.hints && (
                <p className="text-red-500 ml-2 mt-1">
                    {form.formState.errors.hints.message}
                </p>
              )}
                <div className="flex justify-end pt-2"> 
                  <Button
                      type="button"
                      variant="outline"
                      className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                      onClick={() => append({ value: "" })}
                  >
                      <FaPlus className="mr-2" /> 힌트 추가
                  </Button>
              </div>
          </div>
          
          {/* 6. 문제 타입 (순서 변경) */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center">
                    문제 타입<span className="text-red-500 ml-0">*</span>
                  </span>
                </FormLabel>
                <FormDescription className="text-gray-400 ml-2">
                  물리 타입: 미디어 없음, 트리거 타입: 미디어 필수
                </FormDescription>
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
          {/* -------------------------------------------------------------------------- */}
          
          {/* 7. 미디어 (타입이 'trigger'일 경우) */}
          {problemType === "trigger" && (
            <div className="space-y-6 border p-4 rounded-md bg-[#171717] border-[#2d2d2d]">
              <h3 className="text-lg font-semibold text-white">미디어 (트리거 타입 문제)</h3>
              <FileUploadField name="videoKey" label="비디오" />
              <FileUploadField name="imageKey" label="이미지" />
              <FormField
                control={form.control}
                name="media.text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">텍스트</FormLabel>
                    <FormControl>
                      <Textarea placeholder="미디어 텍스트" {...field} value={field.value || ""} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                    </FormControl>
                    <FormDescription className="text-gray-400 ml-2">
                      문제와 함께 표시될 텍스트입니다.
                    </FormDescription>
                    <FormMessage className="text-red-500 ml-2" />
                  </FormItem>
                )}
              />
              <FileUploadField name="bgmKey" label="배경음악" />
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || uploading !== null} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              {isSubmitting ? "저장 중..." : (uploading ? "업로드 중..." : "저장")}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{dialogMessage.includes("실패") || dialogMessage.includes("잘못된") ? "오류" : "성공"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{dialogMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={handleDialogClose} className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}