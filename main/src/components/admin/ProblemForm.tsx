"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Problem, ProblemType } from "@/types/dbTypes";
import { addProblem, updateProblem, getProblemsByTheme } from "@/lib/firestoreService";
import { FaPlus, FaTrash } from "react-icons/fa";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FileUploadField from "@/components/FileUploadField";

interface ProblemFormProps {
  initialData?: Problem;
  themeId: string;
  availableDevices: string[];
  onSuccess?: () => void;
  nextProblemNumber?: number;
}

// --- Zod 스키마 정의 ---
const hintSchema = z.object({
    value: z.string().min(1, { message: "힌트 내용을 입력하세요." })
});

const problemMediaSchema = z.object({
  videoKey: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  bgmKey: z.string().nullable().optional(),
});

const triggerEntrySchema = z.object({
  targetDevice: z.string().min(1, { message: "대상 장치를 선택해야 합니다." }),
  mediaState: problemMediaSchema.nullable(),
});

const problemFormSchema = z.object({
  themeId: z.string().min(1, { message: "테마 ID는 필수입니다." }),
  title: z.string().min(1, { message: "문제 제목은 필수입니다." }),
  type: z.enum(["physical", "trigger"], { message: "문제 타입은 필수입니다." }),
  code: z.string().min(1, { message: "문제 코드는 필수입니다." }),
  device: z.string().optional(),
  
  hints: z.array(hintSchema).min(1, { message: "최소 1개의 힌트를 입력해야 합니다." }),
      
  solution: z.string().min(1, { message: "정답은 필수입니다." }),
  media: problemMediaSchema.nullable().optional(), // 로컬 트리거
  triggers: z.array(triggerEntrySchema).optional(), // 원격 트리거 목록
}).superRefine((data, ctx) => {
  // --- 타입별 조건부 유효성 검사 ---

  if (data.type === "trigger") {
    // 트리거 타입: device 필드는 필수
    if (!data.device) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "트리거 타입 문제는 장치 할당이 필수입니다.",
        path: ["device"],
      });
    }

    // triggers 배열 내 targetDevice 중복 검사
    const targetDevices = new Set<string>();
    data.triggers?.forEach((trigger, index) => {
      if (targetDevices.has(trigger.targetDevice)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `대상 장치 '${trigger.targetDevice}'는 중복될 수 없습니다.`,
          path: [`triggers.${index}.targetDevice`],
        });
      }
      targetDevices.add(trigger.targetDevice);
      
      // triggers 배열 내 targetDevice가 Problem.device와 같을 수 없음
      if (data.device && trigger.targetDevice === data.device) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `트리거 문제 장치(${data.device})와 원격 트리거 대상 장치는 같을 수 없습니다.`,
              path: [`triggers.${index}.targetDevice`],
          });
      }
    });

  } else if (data.type === "physical") {
    // 물리 타입: 미디어 및 트리거를 가질 수 없음
    if (data.media && (data.media.videoKey || data.media.imageKey || data.media.text || data.media.bgmKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "물리 타입 문제는 자체 미디어를 가질 수 없습니다.",
        path: ["media"],
      });
    }
    if (data.triggers && data.triggers.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "물리 타입 문제는 원격 트리거를 가질 수 없습니다.",
            path: ["triggers"],
        });
    }
    if (data.device) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "물리 타입 문제는 장치를 할당할 수 없습니다.",
        path: ["device"],
      });
    }
  }
});

type ProblemFormValues = z.infer<typeof problemFormSchema>;

// --- 파일 업로드 설정 상수 ---
const PROBLEM_MEDIA_ACCEPTED_FILE_TYPES = {
  videoKey: 'video/mp4,video/webm,video/ogg,video/quicktime',
  imageKey: 'image/jpeg,image/png,image/webp,image/gif',
  bgmKey: 'audio/mp3,audio/wav,audio/ogg,audio/mpeg',
};
const PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS = {
  videoKey: 'MP4, WebM, OGG, MOV 등의 비디오 파일',
  imageKey: 'JPG, PNG, WebP, GIF 등의 이미지 파일',
  bgmKey: 'MP3, WAV, OGG 등의 오디오 파일',
};

// --- ProblemForm 컴포넌트 본체 ---
export default function ProblemForm({ initialData, themeId, availableDevices, onSuccess, nextProblemNumber }: ProblemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [dialogMessage, setDialogMessage] = useState("");
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);

  // 폼 초기화
  const form = useForm<ProblemFormValues>({
    resolver: zodResolver(problemFormSchema),
    defaultValues: {
      themeId: themeId,
      title: initialData?.title || "",
      type: initialData?.type || "physical",
      code: initialData?.code || "",
      device: initialData?.device || "기본장치", // 기본값을 '기본장치'로 설정
      hints: initialData?.hints?.length ? initialData.hints.map(h => ({ value: h })) : [{ value: "" }],
      solution: initialData?.solution || "",
      media: initialData?.media ?? (initialData?.type === "trigger" ? { videoKey: null, imageKey: null, text: null, bgmKey: null } : undefined),
      triggers: initialData?.triggers || [], // 새로운 triggers 배열 초기화
    },
    mode: "onChange",
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hints",
  });

  const { fields: triggerFields, append: appendTrigger, remove: removeTrigger } = useFieldArray({
    control: form.control,
    name: "triggers",
  });

  const problemType = form.watch("type");

  useEffect(() => {
    if (problemType === 'physical') {
      form.setValue('device', undefined, { shouldValidate: true });
    }
  }, [problemType, form]);

  // 파일 업로드 로직
  const handleFileUpload = useCallback(async (file: File | null, fieldPath: Path<ProblemFormValues>): Promise<string | null> => {
    if (!file) return null;
    setUploadingStatus(fieldPath);
    try {
            // 1. Signed URL 요청
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

      // 2. 파일 직접 업로드
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('R2 업로드 실패');
      
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

  // 폼 제출 핸들러
  async function onSubmit(values: ProblemFormValues) {
    setIsSubmitting(true);
    try {
      // 중복 검사 (제목, 코드, 정답)
      const existingProblems = await getProblemsByTheme(values.themeId);
      const problemsToCheck = initialData ? existingProblems.filter(p => p.id !== initialData.id) : existingProblems;

      const trimmedCode = values.code.trim();
      const trimmedTitle = values.title.trim();
      const trimmedSolution = values.solution.trim();

      if (problemsToCheck.some(p => p.code.trim() === trimmedCode)) {
        setDialogMessage(`이미 존재하는 문제 코드(${trimmedCode})입니다.`); setIsAlertDialogOpen(true); return;
      }
      if (problemsToCheck.some(p => p.title.trim() === trimmedTitle)) {
        setDialogMessage(`이미 존재하는 문제 제목(${trimmedTitle})입니다.`); setIsAlertDialogOpen(true); return;
      }
      if (problemsToCheck.some(p => p.solution.trim() === trimmedSolution)) {
        setDialogMessage(`이미 존재하는 정답(${trimmedSolution})입니다.`); setIsAlertDialogOpen(true); return;
      }

      // 힌트 객체 배열을 string 배열로 변환
      const hintsArray = values.hints.map(h => h.value.trim()).filter(h => h.length > 0);
        
      // DB 저장을 위한 최종 미디어 객체 정리 (로컬 트리거)
      let finalMedia = null;
      if (values.type === "trigger" && values.media) {
          const mediaObject = values.media;
          finalMedia = {
              videoKey: mediaObject.videoKey || null,
              imageKey: mediaObject.imageKey || null,
              text: mediaObject.text?.trim() || null, 
              bgmKey: mediaObject.bgmKey || null,
          };
          const isMediaEmpty = !finalMedia.videoKey && !finalMedia.imageKey && !finalMedia.text && !finalMedia.bgmKey;
          if (isMediaEmpty) { // 모든 필드가 null이면 객체 자체를 null로 처리
              finalMedia = null;
          }
      }

      // DB 저장을 위한 최종 triggers 배열 정리 (원격 트리거)
      const finalTriggers = values.triggers
        ?.filter(trigger => trigger.targetDevice && (trigger.mediaState?.videoKey || trigger.mediaState?.imageKey || trigger.mediaState?.text || trigger.mediaState?.bgmKey)) // targetDevice가 있고 미디어 내용이 있는 트리거만 필터링
        .map(trigger => ({
          targetDevice: trigger.targetDevice,
          mediaState: {
            videoKey: trigger.mediaState?.videoKey || null,
            imageKey: trigger.mediaState?.imageKey || null,
            text: trigger.mediaState?.text?.trim() || null,
            bgmKey: trigger.mediaState?.bgmKey || null,
          },
        }));

      const dataToSave: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'> = {
          themeId: values.themeId,
          number: initialData?.number || nextProblemNumber || 1,
          title: values.title,
          type: values.type as ProblemType,
          code: values.code,
          hints: hintsArray,
          solution: values.solution,
          media: finalMedia, // 로컬 트리거
          triggers: finalTriggers && finalTriggers.length > 0 ? finalTriggers : [], // 원격 트리거
          device: values.type === "trigger" ? values.device || "default" : null, // 물리 타입일 경우 undefined 대신 null 저장
      };

      // Firestore에 저장/업데이트
      if (initialData) {
        await updateProblem(values.themeId, initialData.id, dataToSave); 
        setDialogMessage("문제가 성공적으로 업데이트되었습니다.");
      } else {
        await addProblem(values.themeId, dataToSave); 
        setDialogMessage("문제가 성공적으로 생성되었습니다.");
      }

      setIsAlertDialogOpen(true);
    } catch (error) {
      console.error("문제 저장 실패:", error);
      setDialogMessage("문제 저장에 실패했습니다.");
      setIsAlertDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 다이얼로그 닫기 및 성공 시 리디렉션
  const handleAlertDialogClose = () => {
    setIsAlertDialogOpen(false);
    if (dialogMessage.includes("성공")) {
      onSuccess?.();
      router.push(`/admin/themes/${themeId}/problems`);
    }
  };

  // --- 폼 렌더링 ---
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4">

          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white"><span className="flex items-center">제목<span className="text-red-500 ml-0">*</span></span></FormLabel>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          <FormField control={form.control} name="solution" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white"><span className="flex items-center">정답<span className="text-red-500 ml-0">*</span></span></FormLabel>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white"><span className="flex items-center">문제 코드<span className="text-red-500 ml-0">*</span></span></FormLabel>
              <FormDescription className="text-gray-400 ml-2">이 코드를 입력하면 힌트가 제공됩니다.</FormDescription>
              <FormControl><Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white" /></FormControl>
              <FormMessage className="text-red-500 ml-2" />
            </FormItem>
          )}/>
          
          {/* 힌트 목록 */}
          <div className="space-y-4">
              <FormLabel className="text-white block"><span className="flex items-center">힌트 목록<span className="text-red-500 ml-0">*</span></span></FormLabel>
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
                                <Button
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
                              <FormMessage className="text-red-500 ml-[62px]" /> 
                          </FormItem>
                      )}
                  />
              ))}
              {form.formState.errors.hints && typeof form.formState.errors.hints.message === 'string' && (
                <p className="text-red-500 ml-2 mt-1">{form.formState.errors.hints.message}</p>
              )}
                <div className="flex justify-end pt-2"> 
                  <Button type="button" variant="outline" className="text-white hover:bg-[#282828]" onClick={() => append({ value: "" })}>
                      <FaPlus className="mr-2" /> 힌트 추가
                  </Button>
              </div>
          </div>
          
          {/* 문제 타입 선택 */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white"><span className="flex items-center">문제 타입<span className="text-red-500 ml-0">*</span></span></FormLabel>
                <FormDescription className="text-gray-400 ml-2">'물리'는 앱 상호작용이 없으며, '트리거'는 앱과 상호작용합니다.</FormDescription>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-[#171717] border-[#2d2d2d] text-white focus:ring-0">
                      <SelectValue placeholder="문제 타입을 선택하세요" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                    <SelectItem value="physical">물리 (Physical)</SelectItem>
                    <SelectItem value="trigger">트리거 (Trigger)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-red-500 ml-2" />
              </FormItem>
            )}
          />

          {/* 문제 할당 장치 (Trigger 타입일 때만 표시) */}
          {problemType === "trigger" && (
            <FormField
              control={form.control}
              name="device"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">문제 할당 장치</FormLabel>
                  <FormDescription className="text-gray-400 ml-2">트리거 문제를 할당할 장치를 선택합니다. 선택하지 않으면 '기본장치'에 할당됩니다.</FormDescription>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-[#171717] border-[#2d2d2d] text-white focus:ring-0">
                        <SelectValue placeholder="장치를 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                          {availableDevices.map(device => (
                              <SelectItem key={device} value={device}>{device}</SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-500 ml-2" />
                </FormItem>
              )}
            />
          )}
          
          {/* 문제 자체 미디어 필드 (Trigger 타입일 때만 표시) */}
          {problemType === "trigger" && (
            <div className="space-y-6 border p-4 rounded-md bg-[#171717] border-[#2d2d2d]">
              <h3 className="text-lg font-semibold text-white">트리거 미디어 설정</h3>
              
              <FileUploadField<ProblemFormValues>
                fieldPath="media.videoKey"
                label="비디오" 
                currentKey={form.watch("media.videoKey")}
                onFileChange={async (file) => {
                    const key = await handleFileUpload(file, "media.videoKey");
                    form.setValue("media.videoKey", key, { shouldValidate: true, shouldDirty: true });
                }}
                onClear={() => form.setValue("media.videoKey", null, { shouldValidate: true, shouldDirty: true })}
                uploadingStatus={uploadingStatus}
                setDialogMessage={setDialogMessage}
                setIsDialogOpen={setIsAlertDialogOpen}
                acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
              />
              <FileUploadField<ProblemFormValues>
                fieldPath="media.bgmKey"
                label="배경음악" 
                currentKey={form.watch("media.bgmKey")}
                onFileChange={async (file) => {
                    const key = await handleFileUpload(file, "media.bgmKey");
                    form.setValue("media.bgmKey", key, { shouldValidate: true, shouldDirty: true });
                }}
                onClear={() => form.setValue("media.bgmKey", null, { shouldValidate: true, shouldDirty: true })}
                uploadingStatus={uploadingStatus}
                setDialogMessage={setDialogMessage}
                setIsDialogOpen={setIsAlertDialogOpen}
                acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
              />
              <FileUploadField<ProblemFormValues>
                fieldPath="media.imageKey"
                label="이미지" 
                currentKey={form.watch("media.imageKey")}
                onFileChange={async (file) => {
                    const key = await handleFileUpload(file, "media.imageKey");
                    form.setValue("media.imageKey", key, { shouldValidate: true, shouldDirty: true });
                }}
                onClear={() => form.setValue("media.imageKey", null, { shouldValidate: true, shouldDirty: true })}
                uploadingStatus={uploadingStatus}
                setDialogMessage={setDialogMessage}
                setIsDialogOpen={setIsAlertDialogOpen}
                acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
              />
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
                    <FormMessage className="text-red-500 ml-2" />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* 원격 트리거 목록 설정 (Trigger 타입일 때만 표시) */}
          {problemType === "trigger" && (
            <div className="space-y-6 border p-4 rounded-md bg-[#171717] border-[#2d2d2d]">
              <h3 className="text-lg font-semibold text-white mb-4">원격 트리거 목록 설정</h3>
              
              {triggerFields.map((field, index) => (
                <div key={field.id} className="border-t border-gray-700 pt-4 mt-4 first:border-t-0 first:pt-0">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-gray-300">트리거 #{index + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTrigger(index)} className="text-red-500 hover:bg-[#282828]">
                      <FaTrash className="mr-2" /> 트리거 삭제
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name={`triggers.${index}.targetDevice`}
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel className="text-white"><span className="flex items-center">대상 장치<span className="text-red-500 ml-0">*</span></span></FormLabel>
                        <FormDescription className="text-gray-400 ml-2">원격으로 미디어를 트리거할 대상 장치를 선택합니다.</FormDescription>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-[#171717] border-[#2d2d2d] text-white focus:ring-0">
                              <SelectValue placeholder="대상 장치를 선택하세요" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                            {/* 문제 자체에 할당된 장치와 현재 문제 내 다른 원격 트리거에서 이미 사용 중인 장치 제외 */}
                            {availableDevices
                              .filter(d => d !== form.watch("device")) // 문제 자체에 할당된 장치 제외
                              .filter(d => 
                                !triggerFields.some((otherTrigger, otherIndex) => 
                                  otherIndex !== index && otherTrigger.targetDevice === d
                                )
                              ) // 현재 원격 트리거를 제외한 다른 원격 트리거에서 사용 중인 장치 제외
                              .map(device => (
                                <SelectItem key={device} value={device}>{device}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 ml-2" />
                      </FormItem>
                    )}
                  />
                  {/* 트리거별 미디어 설정 */}
                  <div className="space-y-6"> {/* <--- Added space-y-6 here */}
                    <FileUploadField
                      fieldPath={`triggers.${index}.mediaState.videoKey`}
                      label="비디오" 
                      currentKey={form.watch(`triggers.${index}.mediaState.videoKey`)}
                      onFileChange={async (file) => {
                          const key = await handleFileUpload(file, `triggers.${index}.mediaState.videoKey`);
                          form.setValue(`triggers.${index}.mediaState.videoKey`, key, { shouldValidate: true, shouldDirty: true });
                      }}
                      onClear={() => form.setValue(`triggers.${index}.mediaState.videoKey`, null, { shouldValidate: true, shouldDirty: true })}
                      uploadingStatus={uploadingStatus}
                      setDialogMessage={setDialogMessage}
                      setIsDialogOpen={setIsAlertDialogOpen}
                      acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                      acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
                    />
                    <FileUploadField
                      fieldPath={`triggers.${index}.mediaState.bgmKey`}
                      label="배경음악" 
                      currentKey={form.watch(`triggers.${index}.mediaState.bgmKey`)}
                      onFileChange={async (file) => {
                          const key = await handleFileUpload(file, `triggers.${index}.mediaState.bgmKey`);
                          form.setValue(`triggers.${index}.mediaState.bgmKey`, key, { shouldValidate: true, shouldDirty: true });
                      }}
                      onClear={() => form.setValue(`triggers.${index}.mediaState.bgmKey`, null, { shouldValidate: true, shouldDirty: true })}
                      uploadingStatus={uploadingStatus}
                      setDialogMessage={setDialogMessage}
                      setIsDialogOpen={setIsAlertDialogOpen}
                      acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                      acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
                    />
                    <FileUploadField
                      fieldPath={`triggers.${index}.mediaState.imageKey`}
                      label="이미지" 
                      currentKey={form.watch(`triggers.${index}.mediaState.imageKey`)}
                      onFileChange={async (file) => {
                          const key = await handleFileUpload(file, `triggers.${index}.mediaState.imageKey`);
                          form.setValue(`triggers.${index}.mediaState.imageKey`, key, { shouldValidate: true, shouldDirty: true });
                      }}
                      onClear={() => form.setValue(`triggers.${index}.mediaState.imageKey`, null, { shouldValidate: true, shouldDirty: true })}
                      uploadingStatus={uploadingStatus}
                      setDialogMessage={setDialogMessage}
                      setIsDialogOpen={setIsAlertDialogOpen}
                      acceptedFileTypes={PROBLEM_MEDIA_ACCEPTED_FILE_TYPES}
                      acceptedFileDescriptions={PROBLEM_MEDIA_ACCEPTED_FILE_DESCRIPTIONS}
                    />
                    <FormField
                      control={form.control}
                      name={`triggers.${index}.mediaState.text`}
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
                          <FormMessage className="text-red-500 ml-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end mt-4"> 
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendTrigger({ targetDevice: "", mediaState: { videoKey: null, imageKey: null, text: null, bgmKey: null } })}
                  className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]"
                >
                  <FaPlus className="mr-2" /> 원격 트리거 추가
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || uploadingStatus !== null} variant="outline" className="text-white hover:text-gray-300 border-gray-700 hover:bg-[#282828]">
              {isSubmitting ? "저장 중..." : (uploadingStatus ? "업로드 중..." : "저장")}
            </Button>
          </div>
        </form>
      </Form>

      {/* 결과 다이얼로그 */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f1f] text-white border-slate-700/70">
          <DialogHeader>
            <DialogTitle>{dialogMessage.includes("실패") || dialogMessage.includes("잘못된") ? "오류" : "성공"}</DialogTitle>
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