"use client";

import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Theme } from "@/types/dbTypes";
import { useMediaUrl } from "@/lib/useMediaUrl";

interface ThemeCardProps {
  theme: Theme;
  onSelect: (theme: Theme) => void;
}

export default function ThemeCard({ theme, onSelect }: ThemeCardProps) {
  const thumbnailUrl = useMediaUrl(theme.thumbnailKey);
  const defaultImageUrl = '/image.png'; 

  return (
    <Card
      className="bg-white border border-black cursor-pointer transition-all duration-300 ease-out overflow-hidden p-0
                 hover:scale-[1.02] hover:translate-y-[-2px] hover:shadow-2xl hover:shadow-white/70 
                 focus:outline-none focus:scale-[1.02] focus:translate-y-[-2px] focus:shadow-2xl focus:shadow-white/70"
      tabIndex={0} 
      onClick={() => onSelect(theme)}
    >
      
      {/* 1. 이미지: 카드 상단에 여백 없이 배치 */}
      <div className="relative w-full h-48 sm:h-56 md:h-64"> 
        <Image 
          src={thumbnailUrl || defaultImageUrl} 
          alt={theme.title} 
          fill 
          style={{ objectFit: 'cover' }} 
          priority={!thumbnailUrl} 
          className="transition-transform duration-300 hover:scale-105"
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
          {theme.description || "설명이 없습니다."}
        </CardDescription>
      </CardContent>
    </Card>
  );
}