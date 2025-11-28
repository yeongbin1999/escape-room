"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebaseConfig";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 로그인 UI 컴포넌트
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 로그인 성공 후 리디렉션은 AuthContext와 아래의 Home 컴포넌트가 처리
    } catch (error) {
      if (error instanceof FirebaseError) {
        setErrorMessage(`로그인 실패: ${error.message}`);
      } else {
        console.error("알 수 없는 로그인 오류:", error);
        setErrorMessage("로그인 중 알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Card className="w-[420px] max-w-[95%] pt-10 pb-10 pl-3 pr-3 rounded-2xl border border-slate-700/70 bg-[#1f1f1f] shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold text-center tracking-widest text-white">ESCAPE ROOM</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium text-white text-left block">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@example.com"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
                  className="w-full h-12 p-3 rounded-lg border border-slate-700/70 bg-[#111] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-sm font-medium text-white text-left block">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMessage(""); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleLogin(e);
                    }
                  }}
                  className="w-full h-12 p-3 rounded-lg border border-slate-700/70 bg-[#111] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition duration-200"
                />
              </div>
            </div>
          </form>
          {errorMessage && (
            <p className="text-sm text-red-400 mt-6 text-center">{errorMessage}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4 pt-2">
          <Button className="w-full h-11 rounded-lg font-semibold text-base transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-slate-200 active:bg-slate-300 shadow-md hover:shadow-lg" variant="default" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                로그인 중
              </div>
            ) : (
              "이메일 로그인"
            )}
          </Button>    
        </CardFooter>
      </Card>
    </div>
  );
}

// 라우트 가드 로직을 포함한 메인 페이지 컴포넌트
export default function Home() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (role === 'admin') {
        router.push('/admin');
      } else if (role === 'player') {
        router.push('/player');
      }
    }
  }, [role, loading, router]);

  // 로딩 중이거나, 리디렉션이 필요한 경우 로딩 화면 표시
  if (loading || role) {
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

  // 로딩이 끝났고, 역할이 없는 (로그아웃된) 사용자에게만 로그인 페이지를 보여줌
  return <LoginPage />;
}
