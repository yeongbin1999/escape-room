import { Timestamp } from 'firebase/firestore';

export interface Theme {
  id: string;
  title: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  openingVideoKey?: string | null;
  openingBgmKey?: string | null;
  thumbnailKey?: string | null;
  isActive: boolean;
}

export type ProblemType = "physical" | "trigger";

export interface ProblemMedia {
  videoKey?: string | null;
  imageKey?: string | null;
  text?: string | null;
  bgmKey?: string | null;
}

export interface Problem {
  id: string;
  themeId: string;
  number: number;
  title: string;
  type: ProblemType;     // 트리거 타입 문제는 정답을 입력하면 이벤트 트리거
  code: string;          // 모든 문제는 코드가 있음(코드를 입력하면 힌트 제공 별도의 힌트앱을 만들예정)
  media?: ProblemMedia | null;  // 트리거형 문제는 각종 미디어가 있고 정답을 입력하면 이벤트 발생 이것들을 보여줌
  hints: string[];       // 문제에 대한 힌트
  solution: string;      // 문제의 정답
  createdAt: Timestamp;
  updatedAt: Timestamp;
}