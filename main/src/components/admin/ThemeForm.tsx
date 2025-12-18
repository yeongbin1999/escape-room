"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FaPlusCircle, FaMinusCircle } from "react-icons/fa";
import { addTheme, updateTheme } from "@/lib/firestoreService";
import FileUploadField from "@/components/FileUploadField";

// 스키마 정의
const deviceSchema = z.object({
    id: z.string().min(1).max(20),
});

const themeFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  openingVideoKey: z.string().nullable().optional(), 
  openingBgmKey: z.string().nullable().optional(),
  openingImageKey: z.string().nullable().optional(),
  openingText: z.string().nullable().optional(),
  thumbnailKey: z.string().nullable().optional(),
  isActive: z.boolean(),
  availableDevices: z.array(deviceSchema).optional(), 
});

type ThemeFormValues = z.infer<typeof themeFormSchema>;

// 파일 설정 상수
const THEME_ACCEPTED_FILE_TYPES = {
  thumbnailKey: 'image/jpeg,image/png,image/webp,image/gif',
  openingVideoKey: 'video/mp4,video/webm,video/ogg,video/quicktime',
  openingBgmKey: 'audio/mp3,audio/wav,audio/ogg,audio/mpeg',
  openingImageKey: 'image/jpeg,image/png,image/webp,image/gif',
};

const THEME_ACCEPTED_FILE_DESCRIPTIONS = {
    thumbnailKey: 'JPG, PNG, WebP, GIF 등의 이미지 파일',
    openingVideoKey: 'MP4, WebM, OGG, MOV 등의 비디오 파일',
    openingBgmKey: 'MP3, WAV, OGG 등의 오디오 파일',
    openingImageKey: 'JPG, PNG, WebP, GIF 등의 이미지 파일',
};

// Props 인터페이스
interface ThemeFormProps {
  initialData?: Theme;
  onSuccess?: () => void;
}

// ThemeForm 컴포넌트 본체
export default function ThemeForm({ initialData, onSuccess }: ThemeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null); 
  const [dialogMessage, setDialogMessage] = useState("");
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);

  // 폼 초기화 및 유효성 검사 설정
  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      openingVideoKey: initialData?.openingVideoKey || null,
      openingBgmKey: initialData?.openingBgmKey || null,
      openingImageKey: initialData?.openingImageKey || null,
      openingText: initialData?.openingText || null,
      thumbnailKey: initialData?.thumbnailKey || null,
      isActive: initialData?.isActive || false,
      // 문자열 배열 -> 객체 배열 변환
      availableDevices: initialData?.availableDevices?.map(device => ({ id: device })) || [],
    },
    mode: "onChange",
  });

  // 동적 필드 관리
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "availableDevices",
  });

  // 파일 업로드 로직 (Signed URL을 통한 클라이언트 직접 업로드)
  const handleFileUpload = useCallback(async (file: File, fieldName: keyof typeof THEME_ACCEPTED_FILE_TYPES): Promise<string | null> => {
    setUploadingStatus(fieldName);
    try {
      const response = await fetch('/api/upload-url', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Presigned URL 요청 실패');
      }
      const { signedUrl, key } = await response.json();

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('업로드 실패');
      
      return key;
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      setDialogMessage(`${file.name} 파일 업로드에 실패했습니다: ${(error as Error).message}`);
      setIsAlertDialogOpen(true);
      return null;
    } finally {
      setUploadingStatus(null);
    }
  }, []);

  // 폼 제출 처리 함수
  async function onSubmit(values: ThemeFormValues) {
    setIsSubmitting(true);
    try {
      // 객체 배열 -> 문자열 배열 변환
      const dataToSave = {
        ...values,
        openingVideoKey: values.openingVideoKey || null,
        openingBgmKey: values.openingBgmKey || null,
        openingImageKey: values.openingImageKey || null,
        openingText: values.openingText || null,
        thumbnailKey: values.thumbnailKey || null,
        availableDevices: values.availableDevices?.map(device => device.id) || [],
      };

      if (initialData) {
        await updateTheme(initialData.id, dataToSave);
        setDialogMessage("테마가 성공적으로 업데이트되었습니다.");
      } else {
        await addTheme(dataToSave);
        setDialogMessage("테마가 성공적으로 생성되었습니다.");
      }
      setIsAlertDialogOpen(true);
    } catch (error) {
      console.error("테마 저장 실패:", error);
      setDialogMessage("테마 저장에 실패했습니다.");
      setIsAlertDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 알림 다이얼로그 닫기 및 후처리
  const handleAlertDialogClose = () => {
    setIsAlertDialogOpen(false);
    if (dialogMessage.includes("성공")) {
      onSuccess?.();
      router.push("/admin/themes");
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4 max-h-[85vh] overflow-y-auto custom-scroll">
          
          {/* 제목 필드 */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white"><span className="flex items-center">제목<span className="text-red-500 ml-0">*</span></span></FormLabel>
                <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" /></FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 설명 필드 */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white"><span className="flex items-center">설명<span className="text-red-500 ml-0">*</span></span></FormLabel>
                <FormControl><Textarea {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" /></FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 동적 장치 목록 필드 */}
          <div>
            <FormLabel className="text-white">장치 목록</FormLabel>
            <FormDescription className="text-gray-400 mt-2 ml-2 mb-2">
              이 테마에서 사용할 부가 장치들을 추가하세요.
            </FormDescription>
            {fields.map((item, index) => (
              <div key={item.id} className="flex items-start space-x-2 mb-2">
                <FormField
                  control={form.control}
                  name={`availableDevices.${index}.id`}
                  render={({ field }) => (
                    <FormItem className="flex-grow">
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage className="text-red-500 ml-2" />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  <FaMinusCircle className="text-red-500" />
                </Button>
              </div>
            ))}
            
            <div className="flex justify-end mt-2"> 
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ id: "" })}
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
              >
                <FaPlusCircle className="mr-2" /> 장치 추가
              </Button>
            </div>
          </div>

          {/* 파일 업로드 필드: 메인 이미지 */}
          <FileUploadField
            fieldPath={"thumbnailKey" as keyof ThemeFormValues}
            label="메인 이미지"
            currentKey={form.watch("thumbnailKey")}
            onFileChange={async (file) => {
              const key = file ? await handleFileUpload(file, "thumbnailKey") : null;
              form.setValue("thumbnailKey", key, { shouldValidate: true, shouldDirty: true });
            }}
            onClear={() => form.setValue("thumbnailKey", null, { shouldValidate: true, shouldDirty: true })}
            uploadingStatus={uploadingStatus}
            setDialogMessage={setDialogMessage}
            setIsDialogOpen={setIsAlertDialogOpen}
            acceptedFileTypes={THEME_ACCEPTED_FILE_TYPES}
            acceptedFileDescriptions={THEME_ACCEPTED_FILE_DESCRIPTIONS}
          />

          {/* 파일 업로드 필드: 오프닝 영상 */}
          <FileUploadField
            fieldPath={"openingVideoKey" as keyof ThemeFormValues}
            label="오프닝 영상"
            currentKey={form.watch("openingVideoKey")}
            onFileChange={async (file) => {
              const key = file ? await handleFileUpload(file, "openingVideoKey") : null;
              form.setValue("openingVideoKey", key, { shouldValidate: true, shouldDirty: true });
            }}
            onClear={() => form.setValue("openingVideoKey", null, { shouldValidate: true, shouldDirty: true })}
            uploadingStatus={uploadingStatus}
            setDialogMessage={setDialogMessage}
            setIsDialogOpen={setIsAlertDialogOpen}
            acceptedFileTypes={THEME_ACCEPTED_FILE_TYPES}
            acceptedFileDescriptions={THEME_ACCEPTED_FILE_DESCRIPTIONS}
          />
          
          {/* 파일 업로드 필드: 오프닝 BGM */}
          <FileUploadField
            fieldPath={"openingBgmKey" as keyof ThemeFormValues}
            label="오프닝 BGM"
            currentKey={form.watch("openingBgmKey")}
            onFileChange={async (file) => {
              const key = file ? await handleFileUpload(file, "openingBgmKey") : null;
              form.setValue("openingBgmKey", key, { shouldValidate: true, shouldDirty: true });
            }}
            onClear={() => form.setValue("openingBgmKey", null, { shouldValidate: true, shouldDirty: true })}
            uploadingStatus={uploadingStatus}
            setDialogMessage={setDialogMessage}
            setIsDialogOpen={setIsAlertDialogOpen}
            acceptedFileTypes={THEME_ACCEPTED_FILE_TYPES}
            acceptedFileDescriptions={THEME_ACCEPTED_FILE_DESCRIPTIONS}
          />

          {/* 파일 업로드 필드: 오프닝 이미지 */}
          <FileUploadField
            fieldPath={"openingImageKey" as keyof ThemeFormValues}
            label="오프닝 이미지"
            currentKey={form.watch("openingImageKey")}
            onFileChange={async (file) => {
              const key = file ? await handleFileUpload(file, "openingImageKey") : null;
              form.setValue("openingImageKey", key, { shouldValidate: true, shouldDirty: true });
            }}
            onClear={() => form.setValue("openingImageKey", null, { shouldValidate: true, shouldDirty: true })}
            uploadingStatus={uploadingStatus}
            setDialogMessage={setDialogMessage}
            setIsDialogOpen={setIsAlertDialogOpen}
            acceptedFileTypes={THEME_ACCEPTED_FILE_TYPES}
            acceptedFileDescriptions={THEME_ACCEPTED_FILE_DESCRIPTIONS}
          />
          
          {/* 오프닝 텍스트 필드 */}
          <FormField
            control={form.control}
            name="openingText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">오프닝 텍스트</FormLabel>
                <FormControl>
                  <Textarea
                      {...field}
                      value={field.value ?? ""}
                      className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0"
                  />
                </FormControl>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 활성화 여부 체크박스 */}
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow bg-[#171717] border-[#2d2d2d]">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-white">테마 활성화</FormLabel>
                  <FormDescription>이 테마를 사용자에게 표시할지 여부</FormDescription>
                </div>
              </FormItem>
            )}
          />
          
          {/* 폼 제출 버튼 */}
          <div className="flex justify-end">
            <Button 
                type="submit" 
                variant="outline" 
                disabled={isSubmitting || uploadingStatus !== null} 
                className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
            >
              {isSubmitting ? "저장 중..." : (uploadingStatus ? "업로드 중..." : "저장")}
            </Button>
          </div>
        </form>
      </Form>

      {/* 저장 결과 알림 다이얼로그 */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{dialogMessage.includes("실패") ? "오류" : "성공"}</DialogTitle>
          </DialogHeader>
          <div className="py-4"><p>{dialogMessage}</p></div>
          <DialogFooter>
            <Button onClick={handleAlertDialogClose} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}