/**
 * 이 파일은 Tailwind CSS 클래스 이름을 조건부로 결합하고 충돌을 해결하기 위한
 * 유틸리티 함수를 제공합니다. `clsx`와 `tailwind-merge` 라이브러리를 결합하여 사용합니다.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind CSS 클래스들을 유연하게 조합하고, 중복되거나 충돌하는 클래스들을
 * Tailwind 규칙에 따라 올바르게 병합하여 최종 클래스 문자열을 생성합니다.
 *
 * @param inputs `clsx`에서 허용하는 모든 타입의 입력 (문자열, 객체, 배열 등).
 * @returns 병합된 클래스 문자열.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
