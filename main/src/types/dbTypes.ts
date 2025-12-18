import { Timestamp } from 'firebase/firestore';

/**
 * 1. 테마 정의 (Theme)
 * 게임의 기본 설정, 메타데이터, 시작 시 미디어 정보를 정의합니다.
 */
export interface Theme {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  
  /** 테마에서 사용 가능한 추가 장치 이름 목록 (옵션) */
  availableDevices?: string[];

  // --- 미디어 키 (선택 사항) ---
  thumbnailKey?: string | null;
  openingVideoKey?: string | null;
  openingBgmKey?: string | null;
  openingImageKey?: string | null;
  openingText?: string | null;

  // --- 메타데이터 ---
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


/**
 * 2. 문제 관련 정의 (ProblemType, ProblemMedia, Problem)
 */

/** 문제 유형을 정의합니다. */
export type ProblemType = "physical" | "trigger";

/**
 * 문제 해결/힌트 시 장치에 적용될 미디어 상태를 정의합니다.
 */
export interface ProblemMedia {
  // 일시적 미디어: 한번 재생 후 사라짐
  videoKey?: string | null;

  // 지속적 미디어: 다음 트리거로 덮어쓰거나 클리어 지시까지 유지
  imageKey?: string | null; // 예: 배경 이미지, 힌트 이미지
  text?: string | null;     // 예: 힌트 텍스트
  bgmKey?: string | null;   // 예: 배경 음악
}

/**
 * 개별 문제의 상세 정보와 해결 시 트리거를 정의합니다.
 */
export interface Problem {
  id: string;
  themeId: string;
  number: number;     // 테마 내 문제의 순서
  title: string;
  type: ProblemType;
  code: string;       // 문제를 식별하는 고유 코드 (예: P01, T02)
  solution: string;   // 문제의 정답
  hints: string[];    // 힌트 문자열 목록
  
  /** 문제를 담당하는 장치 이름 (ProblemType이 'trigger'일 경우) */
  device?: string | null;    

  /** * 로컬 트리거: 문제 푼 장치 자체에서 실행할 미디어 정보.
   * ProblemMedia 정의에 따라 일시적/지속적 미디어가 작동합니다.
   */
  media?: ProblemMedia | null;

  /** * 원격/추가 트리거: 문제 해결 시 다른 장치들로 보낼 트리거 목록.
   */
  triggers?: {
    targetDevice: string;     // 트리거를 적용할 대상 장치 이름
    mediaState: ProblemMedia; // 대상 장치에서 실행할 미디어/이벤트 정보
  }[];
  
  // --- 메타데이터 ---
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


/**
 * @interface ConnectedDevice
 * 게임 세션에 연결된 각 장치의 상태 정보
 */
export interface ConnectedDevice { 
  status: 'connected' | 'disconnected' | 'ready'; // 장치 연결 상태
  lastSeen: Timestamp;
  
  currentPersistentMedia: {
    videoKey?: string | null;
    imageKey?: string | null;
    text?: string | null;
    bgmKey?: string | null;
  };
}

/**
 * @interface GameState
 * 현재 진행 중인 게임의 실시간 상태를 관리합니다.
 */
export interface GameState {
  id: string;                                         // 세션 ID
  themeId: string;                                    // 기반 테마 ID
  status: 'pending' | 'running' | 'paused' | 'ended'; // 세션 상태
  gameCode: string;                                   // 장치 연결용 코드 (플레이어용)
  currentProblemNumber: number;                       // 현재 플레이어가 진행 중인 문제 번호

  /** 해결된 문제 목록 (Key: problem.code, Value: 해결 시간) */
  solvedProblems: { [problemCode: string]: Timestamp | null };

  /** 연결된 장치 및 상태 목록 (Key: 장치명) */
  connectedDevices: { 
    [deviceId: string]: ConnectedDevice 
  };
  
  // --- 메타데이터 ---
  createdAt: Timestamp;
  updatedAt: Timestamp;
}