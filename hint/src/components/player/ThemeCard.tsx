"use client";

import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Theme } from "@/types/dbTypes";
import { useMediaUrl } from "@/lib/useMediaUrl";

/**
 * @interface ThemeCardProps
 * 테마 카드 컴포넌트가 받는 속성(props)을 정의합니다.
 * @param theme - 표시할 테마 데이터 객체.
 * @param onSelect - 카드를 클릭했을 때 호출될 콜백 함수. 선택된 테마 객체를 인자로 받습니다.
 */
interface ThemeCardProps {
  theme: Theme;
  onSelect: (theme: Theme) => void;
}

/**
 * 플레이어에게 표시될 개별 테마 카드를 렌더링하는 컴포넌트입니다.
 * 테마의 썸네일 이미지, 제목, 설명을 보여주며, 클릭 시 테마 선택 액션을 트리거합니다.
 * Next.js Image 컴포넌트와 Tailwind CSS를 사용하여 최적화된 이미지 로딩과 반응형 디자인을 제공합니다.
 */
export default function ThemeCard({ theme, onSelect }: ThemeCardProps) {
  // 테마의 썸네일 키를 사용하여 미디어 URL을 가져옵니다.
  const thumbnailUrl = useMediaUrl(theme.thumbnailKey);
  // 썸네일이 없을 경우 사용할 기본 이미지 URL.
  const defaultImageUrl = '/image.png'; 

  return (
    <Card
      // 카드 디자인 및 인터랙티브 효과를 위한 Tailwind CSS 클래스.
      // 호버 및 포커스 시 확대, 그림자 효과를 적용하여 사용자 인터랙션을 강조합니다.
      className="bg-white border border-black cursor-pointer transition-all duration-300 ease-out overflow-hidden p-0
                 hover:scale-[1.02] hover:translate-y-[-2px] hover:shadow-2xl hover:shadow-white/70 
                 focus:outline-none focus:scale-[1.02] focus:translate-y-[-2px] focus:shadow-2xl focus:shadow-white/70"
      tabIndex={0} // 키보드 탐색을 위한 접근성 속성.
      onClick={() => onSelect(theme)} // 카드 클릭 시 onSelect 콜백 함수 호출.
    >
      
      {/* 1. 이미지: 카드 상단에 여백 없이 배치 */}
      <div className="relative w-full h-48 sm:h-56 md:h-64"> 
        <Image 
          src={thumbnailUrl || defaultImageUrl} // 썸네일 URL이 없으면 기본 이미지 사용.
          alt={theme.title} // 이미지의 대체 텍스트로 테마 제목 사용.
          fill // 부모 div에 맞춰 이미지를 채웁니다.
          style={{ objectFit: 'cover' }} // 이미지 비율을 유지하면서 컨테이너를 채우도록 설정.
          priority={!thumbnailUrl} // 썸네일 URL이 없을 경우, 즉 기본 이미지를 사용할 경우 로딩 우선순위를 높임.
          className="transition-transform duration-300 hover:scale-105" // 호버 시 이미지 확대 효과.
        />
      </div>

      {/* 2. 제목과 설명은 아래쪽에 배치 */}
      <CardHeader className="p-4 pb-2">
        {/* 흰색 배경에 맞춰 제목 텍스트 색상을 검은색으로 설정 */}
        <CardTitle className="text-xl truncate text-black">{theme.title}</CardTitle>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* 설명 텍스트 색상도 검은 계열로 조정 */}
        <CardDescription className="text-gray-700 line-clamp-2 h-10">
          {theme.description || "설명이 없습니다."} {/* 설명이 없을 경우 기본 텍스트 표시. */}
        </CardDescription>
      </CardContent>
    </Card>
  );
}