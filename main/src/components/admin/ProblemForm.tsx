"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Problem, ProblemType } from "@/types/dbTypes";
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
import { addProblem, updateProblem } from "@/lib/firestoreService"; // These will need to be implemented
import { FaUpload, FaTimes, FaSpinner } from "react-icons/fa";
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

const problemMediaSchema = z.object({
  videoKey: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  bgmKey: z.string().nullable().optional(),
});

const problemFormSchema = z.object({
  themeId: z.string().min(1, { message: "테마 ID는 필수입니다." }),
  number: z.coerce.number().min(1, { message: "문제 번호는 1 이상이어야 합니다." }),
  title: z.string().min(1, { message: "문제 제목은 필수입니다." }),
  type: z.enum(["physical", "trigger"], { message: "문제 타입은 필수입니다." }),
  code: z.string().min(1, { message: "문제 코드는 필수입니다." }),
  hints: z.string().optional(),
  solution: z.string().min(1, { message: "정답은 필수입니다." }),
  media: problemMediaSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.type === "trigger") {
    // For trigger type, media is conceptually required, but individual fields can be optional
    // We'll allow media to be optional here, and handle specific media field requirements later if needed.
    // For now, just ensure media object exists if type is trigger and any media field is provided.
    if (!data.media) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "트리거 타입 문제는 미디어 정보가 필요합니다.",
        path: ["media"],
      });
    }
  } else if (data.type === "physical") {
    // For physical type, media should not be present or should be empty
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
      number: initialData?.number || 1,
      title: initialData?.title || "",
      type: initialData?.type || "physical",
      code: initialData?.code || "",
      hints: initialData?.hints?.join('\n') || "",
      solution: initialData?.solution || "",
      media: initialData?.media || { videoKey: null, imageKey: null, text: null, bgmKey: null },
    },
    mode: "onChange",
  });

  // Watch problem type to conditionally render media fields
  const problemType = form.watch("type");

  useEffect(() => {
    form.setValue("themeId", themeId);
  }, [themeId, form]);

  const handleFileUpload = async (file: File, fieldName: "videoKey" | "imageKey" | "bgmKey"): Promise<string | null> => {
    const acceptedTypes = ACCEPTED_FILE_TYPES[fieldName];
    if (acceptedTypes && !acceptedTypes.split(',').includes(file.type)) {
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

  const FileUploadField = ({ name, label }: { name: "videoKey" | "imageKey" | "bgmKey", label: string }) => {
    // media 객체의 필드를 watch
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
                      if (key) form.setValue(`media.${name}`, key, { shouldValidate: true, shouldDirty: true });
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
          {/* currentKey가 null이 아닌 경우(파일이 있는 경우)에만 삭제 버튼 표시 */}
          {currentKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // form.setValue 호출 시 필드 이름을 `media.${name}`로 수정
              onClick={() => form.setValue(`media.${name}`, null, { shouldValidate: true, shouldDirty: true })}
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
      const hintsArray = values.hints ? values.hints.split('\n').map(hint => hint.trim()).filter(hint => hint.length > 0) : [];

      const dataToSave = {
        ...values,
        hints: hintsArray,
        // 물리 타입인 경우 media를 null로 저장
        media: values.type === "physical" ? null : (values.media || { videoKey: null, imageKey: null, text: null, bgmKey: null }),
      };

      if (initialData) {
        await updateProblem(initialData.id, dataToSave);
        setDialogMessage("문제가 성공적으로 업데이트되었습니다.");
      } else {
        await addProblem(dataToSave);
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4 max-h-[85vh] overflow-y-auto custom-scroll">
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
                <FormDescription className="text-gray-400 ml-2">
                  물리 타입: 미디어 없음, 트리거 타입: 미디어 필수
                </FormDescription>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
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
          <FormField
            control={form.control}
            name="hints"
            render={({ field }) => (
              <FormItem>
                {/* 힌트는 필수가 아니므로 별표를 추가하지 않음 */}
                <FormLabel className="text-white">힌트</FormLabel>
                <FormControl>
                  <Textarea placeholder="각 힌트를 새 줄에 입력하세요." {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormDescription className="text-gray-400 ml-2">
                  여러 힌트는 줄바꿈으로 구분합니다.
                </FormDescription>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
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
                      <Textarea placeholder="미디어 텍스트" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
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
            <Button type="submit" disabled={isSubmitting || uploading !== null} className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              {isSubmitting ? "저장 중..." : (uploading ? "업로드 중..." : "저장")}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* 다이얼로그 디자인도 ThemeForm에 맞춤 */}
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