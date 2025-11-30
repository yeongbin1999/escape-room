/**
 * 이 컴포넌트는 Firebase Authentication을 초기화하고 플레이어의 자동 로그인을 시도합니다.
 * 시각적으로 렌더링되는 요소는 없으며, 주로 애플리케이션 시작 시 인증 상태를 설정하는
 * 사이드 이펙트(side effect)를 관리하는 역할을 합니다.
 */
"use client";

import { useEffect } from "react";
import { autoSignInPlayer } from "@/lib/auth";

export default function FirebaseAuthInitializer() {
  useEffect(() => {
    // 컴포넌트가 마운트될 때 한 번만 자동 로그인 프로세스를 시작합니다.
    // 빈 의존성 배열(`[]`)은 이 효과가 컴포넌트의 첫 렌더링 시에만 실행되고,
    // 이후 리렌더링 시에는 다시 실행되지 않도록 보장합니다.
    autoSignInPlayer().catch((error) => {
      // 자동 로그인 실패 시 에러를 콘솔에 기록합니다.
      // 실제 애플리케이션에서는 사용자에게 토스트 알림 등을 통해 에러를 알릴 수 있습니다.
      console.error("자동 로그인 실패:", error);
    });
  }, []); // 빈 배열: 컴포넌트 마운트 시 한 번만 실행.

  // 이 컴포넌트는 UI를 렌더링하지 않으므로, `null`을 반환합니다.
  // 이는 리액트에서 시각적 출력이 없는 컴포넌트를 만들 때 표준적인 방법입니다.
  return null; 
}
