"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== 'admin') {
      // 로딩이 끝났는데 admin 역할이 아니면 메인 페이지로 리디렉션
      router.push('/');
    }
  }, [role, loading, router]);

  if (loading || role !== 'admin') {
    // 로딩 중이거나 역할이 admin이 아닐 경우, 리디렉션이 실행될 때까지 로딩 화면을 보여줌
    return (
      <div className="flex items-center justify-center h-screen bg-[#1f1f1f] text-white">
        <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>로딩중</span>
      </div>
    );
  }

  // 역할이 admin이면 자식 페이지(page.tsx)를 렌더링
  return <>{children}</>;
}
