"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Problem, addProblem, updateProblem, getProblemsByTheme } from "@/lib/firestoreService";
import { Timestamp } from "firebase/firestore";

// Zod schema for ProblemMedia
const problemMediaSchema = z.object({
  videoUrl: z.string().url({ message: "유효한 URL을 입력하세요." }).optional().or(z.literal("")),
  imageUrl: z.string().url({ message: "유효한 URL을 입력하세요." }).optional().or(z.literal("")),
  text: z.string().optional(),
  bgmUrl: z.string().url({ message: "유효한 URL을 입력하세요." }).optional().or(z.literal("")),
});

interface ProblemFormProps {
  initialData?: Problem; // For editing existing problems
  themeId: string; // The ID of the parent theme
  onSuccess?: () => void;
}

export default function ProblemForm({ initialData, themeId, onSuccess }: ProblemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zod schema for Problem validation
  const problemFormSchema = z.object({
    number: z.coerce.number().min(1, { message: "문제 번호는 1 이상이어야 합니다." }),
    title: z.string().min(1, { message: "제목은 필수입니다." }),
    type: z.enum(["physical", "trigger"], { message: "유효한 문제 타입을 선택하세요." }),
    code: z.string().nullable(),
    media: problemMediaSchema.optional(),
    hints: z.array(z.string()).optional(), // Array of strings for hints
    solution: z.string().min(1, { message: "정답은 필수입니다." }),
  }).refine(async (data) => {
    if (!themeId) return false; // Should not happen if themeId is required
    const problemsInTheme = await getProblemsByTheme(themeId);
    const isDuplicate = problemsInTheme.some(
      (problem) => problem.number === data.number && problem.id !== initialData?.id
    );
    return !isDuplicate;
  }, {
    message: "해당 테마에 이미 같은 번호의 문제가 존재합니다.",
    path: ["number"],
  });

  type ProblemFormValues = z.infer<typeof problemFormSchema>;

  const form = useForm<ProblemFormValues>({
    resolver: zodResolver(problemFormSchema),
    defaultValues: initialData
      ? {
          number: initialData.number,
          title: initialData.title,
          type: initialData.type,
          code: initialData.code || null,
          media: initialData.media || {},
          hints: initialData.hints || [],
          solution: initialData.solution,
        }
      : {
          number: 1,
          title: "",
          type: "physical",
          code: null,
          media: {},
          hints: [],
          solution: "",
        },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hints",
  });

  async function onSubmit(values: ProblemFormValues) {
    setIsSubmitting(true);
    try {
      if (initialData) {
        // Update existing problem
        await updateProblem(themeId, initialData.id, {
          ...values,
          updatedAt: Timestamp.now(),
        });
        alert("문제가 성공적으로 업데이트되었습니다.");
      } else {
        // Create new problem
        await addProblem(themeId, {
          ...values,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        alert("문제가 성공적으로 생성되었습니다.");
      }
      onSuccess?.();
      router.push(`/admin/${themeId}/problems`);
    } catch (error) {
      console.error("Error saving problem:", error);
      alert("문제 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">문제 번호</FormLabel>
              <FormControl>
                <Input type="number" placeholder="문제 번호" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제의 고유 번호를 입력하세요.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">문제 제목</FormLabel>
              <FormControl>
                <Input placeholder="문제 제목" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제의 제목을 입력하세요.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">문제 타입</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-[#171717] border-[#2d2d2d] text-white focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder="문제 타입을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-[#1f1f1f] text-white border-[#2d2d2d]">
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="trigger">Trigger</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-gray-400">
                문제의 타입을 선택하세요. (Physical: 물리적 해결, Trigger: 정답 입력 시 이벤트 발생)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">문제 코드</FormLabel>
              <FormControl>
                <Input placeholder="문제 코드 (선택 사항)" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제와 관련된 코드를 입력하세요. (힌트 제공용)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Problem Media Fields */}
        <h3 className="text-xl font-semibold text-white mt-8 mb-4">문제 미디어 (선택 사항)</h3>
        <FormField
          control={form.control}
          name="media.videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">비디오 URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/video.mp4" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제와 관련된 비디오 URL
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="media.imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">이미지 URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/image.jpg" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제와 관련된 이미지 URL
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="media.text"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">미디어 텍스트</FormLabel>
              <FormControl>
                <Textarea placeholder="문제 설명 텍스트" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제와 관련된 추가 텍스트
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="media.bgmUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">BGM URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/bgm.mp3" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제와 관련된 배경 음악 URL
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hints Field */}
        <h3 className="text-xl font-semibold text-white mt-8 mb-4">힌트</h3>
        {fields.map((item, index) => (
          <FormField
            control={form.control}
            key={item.id}
            name={`hints.${index}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">힌트 {index + 1}</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
                  </FormControl>
                  <Button type="button" variant="destructive" onClick={() => remove(index)}>
                    삭제
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button type="button" onClick={() => append("")} className="bg-gray-600 hover:bg-gray-700 text-white">
          힌트 추가
        </Button>

        <FormField
          control={form.control}
          name="solution"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">정답</FormLabel>
              <FormControl>
                <Input placeholder="문제 정답" {...field} className="bg-[#171717] border-[#2d2d2d] text-white placeholder:text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0" />
              </FormControl>
              <FormDescription className="text-gray-400">
                문제의 정답을 입력하세요.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSubmitting ? "저장 중..." : "문제 저장"}
        </Button>
      </form>
    </Form>
  );
}
