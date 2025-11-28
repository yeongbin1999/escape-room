"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Theme } from "@/types/dbTypes";
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
import { Checkbox } from "@/components/ui/checkbox";
import { addTheme, updateTheme } from "@/lib/firestoreService";
import { FaUpload, FaTimes, FaSpinner } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ThemeFormProps {
  initialData?: Theme;
  onSuccess?: () => void;
}

const themeFormSchema = z.object({
  title: z.string().min(1, { message: "제목은 필수입니다." }),
  description: z.string().min(1, { message: "설명은 필수입니다." }),
  openingVideoKey: z.string().optional(),
  openingBgmKey: z.string().optional(),
  thumbnailKey: z.string().optional(),
  isActive: z.boolean(),
});

type ThemeFormValues = z.infer<typeof themeFormSchema>;

const ACCEPTED_FILE_TYPES = {
  thumbnailKey: 'image/jpeg,image/png,image/webp,image/gif',
  openingVideoKey: 'video/mp4,video/webm,video/ogg,video/quicktime',
  openingBgmKey: 'audio/mp3,audio/wav,audio/ogg,audio/mpeg',
};
const ACCEPTED_FILE_DESCRIPTIONS = {
    thumbnailKey: 'JPG, PNG, WebP, GIF 등의 이미지 파일 미선택시 기본이미지',
    openingVideoKey: 'MP4, WebM, OGG, MOV 등의 비디오 파일',
    openingBgmKey: 'MP3, WAV, OGG 등의 오디오 파일',
};

export default function ThemeForm({ initialData, onSuccess }: ThemeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dialogMessage, setDialogMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      openingVideoKey: initialData?.openingVideoKey || "",
      openingBgmKey: initialData?.openingBgmKey || "",
      thumbnailKey: initialData?.thumbnailKey || "",
      isActive: initialData?.isActive || false,
    },
    mode: "onChange",
  });

  const handleFileUpload = async (file: File, fieldName: "openingVideoKey" | "openingBgmKey" | "thumbnailKey"): Promise<string | null> => {
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

  const FileUploadField = ({ name, label }: { name: "openingVideoKey" | "openingBgmKey" | "thumbnailKey", label: string }) => {
    const currentKey = form.watch(name);
    const acceptAttr = ACCEPTED_FILE_TYPES[name];
    const uiDescription = ACCEPTED_FILE_DESCRIPTIONS[name];

    return (
      <FormItem>
        <FormLabel className="text-white">{label}</FormLabel>
        <div className="flex items-center space-x-4">
          <FormControl>
            <div className="relative w-full">
              <Input
                id={name}
                type="file"
                className="hidden"
                accept={acceptAttr}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file, name).then(key => {
                      if (key) form.setValue(name, key, { shouldValidate: true, shouldDirty: true });
                      e.target.value = ''; 
                    });
                  }
                }}
              />
              <label
                htmlFor={name}
                className="flex items-center justify-between cursor-pointer rounded-md border border-[#2d2d2d] bg-[#171717] px-3 py-2 text-sm text-gray-400 focus-visible:border-[#4a4a4a]"
              >
                <span className="truncate max-w-[calc(100%-80px)]">
                  {uploading === name ? `업로드 중...` : (currentKey || "파일을 선택하세요")}
                </span>
                {uploading === name ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              </label>
            </div>
          </FormControl>
          {currentKey && currentKey !== 'default' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => form.setValue(name, name === 'thumbnailKey' ? 'default' : '', { shouldValidate: true, shouldDirty: true })}
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

  async function onSubmit(values: ThemeFormValues) {
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...values,
        openingVideoKey: values.openingVideoKey || null,
        openingBgmKey: values.openingBgmKey || null,
        thumbnailKey: values.thumbnailKey || "default",
      };

      if (initialData) {
        await updateTheme(initialData.id, dataToSave);
        setDialogMessage("테마가 성공적으로 업데이트되었습니다.");
      } else {
        await addTheme(dataToSave);
        setDialogMessage("테마가 성공적으로 생성되었습니다.");
      }
      setIsDialogOpen(true);
    } catch (error) {
      console.error("테마 저장 실패:", error);
      setDialogMessage("테마 저장에 실패했습니다.");
      setIsDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    if (dialogMessage.includes("성공")) {
      onSuccess?.();
      router.push("/admin");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4 max-h-[85vh] overflow-y-auto custom-scroll">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center"> 
                    제목<span className="text-red-500 ml-0">*</span> 
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="테마 제목" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  <span className="flex items-center"> 
                    설명<span className="text-red-500 ml-0">*</span> 
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea placeholder="테마 설명" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          <FileUploadField name="thumbnailKey" label="메인 이미지" />
          <FileUploadField name="openingVideoKey" label="오프닝 영상" />
          <FileUploadField name="openingBgmKey" label="오프닝 BGM" />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow bg-[#171717] border-[#2d2d2d]">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-white">테마 활성화</FormLabel>
                  <FormDescription>이 테마를 사용자에게 표시할지 여부</FormDescription>
                </div>
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || uploading !== null} className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
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
            <Button onClick={handleDialogClose} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
