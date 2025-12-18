"use client";

import { FormDescription } from "@/components/ui/form";
import { Path } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FaSpinner, FaTimes, FaUpload } from "react-icons/fa";
import { Button } from "@/components/ui/button";

/**
 * ## 파일 업로드 필드 컴포넌트의 Props 타입 정의
 * @template T - 폼 데이터 객체를 나타내는 제네릭 타입
 */
interface FileUploadFieldProps<T extends object> {
  // 폼 객체 내에서 현재 필드를 식별하는 키
  fieldPath: Path<T>; 
  // 필드에 표시될 레이블
  label: string;
  // 현재 업로드된 파일의 키 또는 이름
  currentKey: string | null | undefined;
  // 파일 선택/변경 시 호출될 콜백 함수
  onFileChange: (file: File | null) => void;
  // 파일 제거 버튼 클릭 시 호출될 콜백 함수
  onClear: () => void;
  // 현재 업로드 중인 필드의 이름 (로딩 표시용)
  uploadingStatus: string | null;
  // 유효성 검사 오류 메시지를 설정하는 함수
  setDialogMessage: (msg: string) => void;
  // 유효성 검사 오류 다이얼로그(모달)를 열고 닫는 함수
  setIsDialogOpen: (isOpen: boolean) => void;
  // 필드 이름별 허용되는 MIME 타입 목록 (HTML accept 속성 값)
  acceptedFileTypes: { [key: string]: string };
  // 사용자에게 보여줄 허용 파일 형식에 대한 설명
  acceptedFileDescriptions: { [key: string]: string };
}

/**
 * **[핵심 수정 로직]**
 * fieldPath (예: "remoteTrigger.media.imageKey")에서 최종 키 (예: "imageKey")를 추출합니다.
 */
const getFinalKey = <T extends object>(path: Path<T>): string => {
    // Path<T>는 string으로 변환 가능하며, .을 기준으로 분리하여 마지막 요소를 가져옵니다.
    const parts = String(path).split('.');
    return parts[parts.length - 1];
};


/**
 * ## 파일 업로드 필드 컴포넌트
 * @template T - 폼 데이터 객체 타입
 * @param props - FileUploadFieldProps<T>
 */
const FileUploadField = <T extends object>({
  fieldPath,
  label,
  currentKey,
  onFileChange,
  onClear,
  uploadingStatus,
  setDialogMessage,
  setIsDialogOpen,
  acceptedFileTypes,
  acceptedFileDescriptions,
}: FileUploadFieldProps<T>) => {

  // 1. fieldPath에서 최종 키 추출 (예: "media.videoKey" -> "videoKey")
  const finalKey = getFinalKey(fieldPath); 
    
  // 2. 추출된 최종 키를 사용하여 상수 객체에서 값 조회
  // HTML <input type="file">의 accept 속성 값 (예: 'image/png,image/jpeg')
  const acceptAttr = acceptedFileTypes[finalKey]; 
  // 사용자에게 보여줄 파일 형식 설명
  const uiDescription = acceptedFileDescriptions[finalKey]; 
    
  // 로딩 상태 확인을 위한 문자열 (fieldPath를 그대로 사용)
  const fieldNameForStatus = String(fieldPath);


  /**
   * 로컬에서 파일 유효성을 검사하고 onFileChange를 호출하는 핸들러
   * @param file - 사용자가 선택한 파일 객체
   */
  const handleLocalFileUpload = async (file: File) => {
    // 1. 파일 형식 유효성 검사 (MIME 타입 확인)
    // acceptAttr이 존재하고, 파일의 타입이 허용 목록에 포함되어 있지 않다면 오류 처리
    if (acceptAttr && !acceptAttr.split(',').includes(file.type)) {
      
      // 사용자에게 보여줄 파일 설명(예: JPG, PNG)을 사용
      const allowedExtensions = acceptedFileDescriptions[finalKey]; 
        
      setDialogMessage(`잘못된 파일 형식입니다. ${allowedExtensions}만 업로드할 수 있습니다.`);
      setIsDialogOpen(true);
      return; // 유효하지 않으면 여기서 중단
    }
    
    // 2. 유효한 경우, 부모 컴포넌트의 콜백 함수 호출
    onFileChange(file);
  };

  return (
    <div>
      {/* 레이블 */}
      <label htmlFor={fieldNameForStatus} className="text-white block mb-1 text-sm font-medium">{label}</label>

      <div className="flex items-center space-x-4">
        <div className="relative w-full">
          {/* 실제 숨겨진 파일 입력 필드 */}
          <Input
            id={fieldNameForStatus}
            type="file"
            className="hidden"
            accept={acceptAttr} // 허용된 파일 형식 지정 (finalKey 사용)
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleLocalFileUpload(file); // 로컬 유효성 검사 및 콜백 호출
                e.target.value = ''; // 다음 파일 선택을 위해 input 값 초기화
              } else {
                onFileChange(null); // 파일 선택 취소 시 null 전달
              }
            }}
          />

          {/* 커스텀 디자인된 파일 선택 버튼 */}
          <label
            htmlFor={fieldNameForStatus}
            className="flex items-center justify-between cursor-pointer rounded-md border border-[#2d2d2d] bg-[#171717] px-3 py-2 text-sm text-gray-400 focus-visible:border-[#4a4a4a] focus-visible:ring-0"
          >
            {/* 파일 이름 또는 상태 표시 */}
            <span className="truncate max-w-[calc(100%-80px)]">
              {uploadingStatus === fieldNameForStatus 
                ? `업로드 중...` 
                : (currentKey || "파일을 선택하세요") 
              }
            </span>
            {/* 아이콘 */}
            {uploadingStatus === fieldNameForStatus ? <FaSpinner className="animate-spin" /> : <FaUpload />}
          </label>
        </div>

        {/* 파일이 있을 경우에만 지우기(Clear) 버튼 표시 */}
        {currentKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear} 
          >
            <FaTimes className="text-red-500" />
          </Button>
        )}
      </div>

      {/* 파일 형식 안내 및 선택 사항 고지 (finalKey 사용) */}
      {/* uiDescription 변수에는 이제 최종 키를 기반으로 조회된 올바른 설명이 담겨 있습니다. */}
      <FormDescription className="ml-2 pt-1 text-gray-400">{uiDescription}</FormDescription>
    </div>
  );
};

export default FileUploadField;