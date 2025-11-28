import type { NextConfig } from "next";
// next-pwa는 import 방식을 사용하는 경우도 있고, require를 사용하는 경우도 있습니다.
// 여기서는 일반적으로 사용되는 import 방식을 유지합니다.
import withPWA from "next-pwa";

// 1. Next.js의 기본 설정
const nextConfig: NextConfig = {
  reactStrictMode: true, // 이 설정이 문제가 되는 항목입니다. 아래 2번을 보세요.
  turbopack: {}, // Turbopack 사용 시 Webpack 설정과의 충돌을 방지하기 위한 빈 설정
  // ... 기타 Next.js 설정
};

// 2. withPWA 함수를 호출하여 PWA 설정을 주입하는 '고차 함수'를 만듭니다.
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Next.js 개발 모드에서는 Service Worker가 캐싱을 방해하지 않도록 비활성화하는 것이 일반적입니다.
  disable: process.env.NODE_ENV === "development",
  // PWA 설정에 NextConfig 옵션을 전달하지 않도록 주의합니다.
});

// 3. 최종적으로 PWA 설정이 적용된 함수에 NextConfig 객체를 전달하여 export 합니다.
export default pwaConfig(nextConfig);