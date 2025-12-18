import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  onSnapshot,
  where,
} from "firebase/firestore";

import type {
  Theme,
  Problem,
  ProblemMedia,
  ProblemType,
  GameState,
  ConnectedDevice,
} from "@/types/dbTypes";

const themesCollection = collection(db, "themes");
const gameSessionsCollection = collection(db, "gameSessions"); 

// Firestore 문서(Document)를 Theme 인터페이스로 변환하는 헬퍼 함수
// @param doc - Firestore에서 가져온 테마 문서 스냅샷
// @returns Theme 인터페이스를 따르는 객체
const docToTheme = (doc: QueryDocumentSnapshot<DocumentData>): Theme => ({
  id: doc.id,
  title: doc.data().title,
  description: doc.data().description,
  createdAt: doc.data().createdAt,
  updatedAt: doc.data().updatedAt,
  openingVideoKey: doc.data().openingVideoKey,
  openingBgmKey: doc.data().openingBgmKey,
  openingImageKey: doc.data().openingImageKey,
  openingText: doc.data().openingText,
  thumbnailKey: doc.data().thumbnailKey,
  isActive: doc.data().isActive,
  availableDevices: doc.data().availableDevices || [], // 사용 가능한 장치 목록 포함
});

// Firestore 문서(Document)를 Problem 인터페이스로 변환하는 헬퍼 함수
// @param doc - Firestore에서 가져온 문제 문서 스냅샷
// @returns Problem 인터페이스를 따르는 객체
const docToProblem = (doc: QueryDocumentSnapshot<DocumentData>): Problem => ({
  id: doc.id,
  themeId: doc.data().themeId,
  number: doc.data().number,
  title: doc.data().title,
  type: doc.data().type,
  code: doc.data().code,
  solution: doc.data().solution || '',
  hints: doc.data().hints || [],
  device: doc.data().device || '기본장치', // 담당 장치 ID 포함 (없으면 '기본장치')
  media: doc.data().media || null, // 로컬 트리거 미디어 정보
  triggers: doc.data().triggers || [], // 원격/추가 트리거 정보 배열
  createdAt: doc.data().createdAt,
  updatedAt: doc.data().updatedAt,
});

// ConnectedDevice의 currentPersistentMedia 기본값 정의
const defaultCurrentPersistentMedia = {
  imageKey: null,
  text: null,
  bgmKey: null,
  videoKey: null,
};

// Firestore 문서(Document)를 GameState 인터페이스로 변환하는 헬퍼 함수 (DocumentSnapshot용)
// 이 함수는 'id' 필드를 포함하여 GameState 객체를 재구성합니다.
// @param docData - Firestore DocumentSnapshot의 데이터와 ID를 포함하는 객체
// @returns GameState 인터페이스를 따르는 객체
const docToGameStateFromDocumentSnapshot = (docData: DocumentData): GameState => {
  const connectedDevicesData = docData.connectedDevices || {};
  const connectedDevices: { [deviceId: string]: ConnectedDevice } = {};

  for (const deviceId in connectedDevicesData) {
    if (Object.prototype.hasOwnProperty.call(connectedDevicesData, deviceId)) {
      const deviceData = connectedDevicesData[deviceId];
      connectedDevices[deviceId] = {
        status: deviceData.status || 'disconnected', // Fallback for status
        lastSeen: deviceData.lastSeen || Timestamp.now(), // Fallback for lastSeen
        currentPersistentMedia: {
          ...defaultCurrentPersistentMedia, // 기본값 적용
          ...(deviceData.currentPersistentMedia || {}), // 저장된 값으로 덮어쓰기
        },
      };
    }
  }

  return {
    id: docData.id,
    themeId: docData.themeId,
    status: docData.status || 'pending', // Fallback for status
    gameCode: docData.gameCode || '',     // Fallback for gameCode
    solvedProblems: docData.solvedProblems || {},
    connectedDevices: connectedDevices,
    currentProblemNumber: docData.currentProblemNumber ?? 1,
    createdAt: docData.createdAt instanceof Timestamp ? docData.createdAt : Timestamp.now(), // Ensure Timestamp object
    updatedAt: docData.updatedAt instanceof Timestamp ? docData.updatedAt : Timestamp.now(), // Ensure Timestamp object
  };
};

// Firestore 문서(Document)를 GameState 인터페이스로 변환하는 헬퍼 함수 (QueryDocumentSnapshot용)
// 이 함수는 GameState 객체에 문서의 ID를 포함시킵니다.
// @param doc - Firestore에서 가져온 GameState 문서 스냅샷
// @returns GameState 인터페이스를 따르는 객체
const docToGameState = (doc: QueryDocumentSnapshot<DocumentData>): GameState => {
  return docToGameStateFromDocumentSnapshot({ id: doc.id, ...doc.data() });
}



/**
 * R2 스토리지 객체 삭제 API 라우트를 호출하는 헬퍼 함수 (미디어 파일 정리)
 * @param key - 삭제할 R2 객체의 키 (예: 파일 경로). null 또는 undefined이면 아무 작업도 수행하지 않습니다.
 * @returns {Promise<void>}
 */
const callR2DeleteApi = async (key: string | null | undefined): Promise<void> => {
  if (!key) return; // 키가 없으면 삭제할 필요 없음

  try {
    const response = await fetch('/api/r2-delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API를 통한 R2 객체 삭제 실패');
    }
  } catch (error) {
    console.error("R2 삭제 API 호출 중 오류 발생 (키: ${key}):", key, error);
    throw error;
  }
};


// --- Theme CRUD (생성, 조회, 수정, 삭제) 작업 ---

/**
 * 모든 테마 목록을 가져옵니다. (생성일 기준 내림차순 정렬)
 * @returns {Promise<Theme[]>} 모든 테마 객체의 배열
 */
export const getThemes = async (): Promise<Theme[]> => {
  const q = query(themesCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToTheme);
};

/**
 * 특정 ID의 테마를 가져옵니다.
 * @param id - 가져올 테마의 ID
 * @returns {Promise<Theme | null>} 해당 테마 객체 또는 찾을 수 없는 경우 null
 */
export const getTheme = async (id: string): Promise<Theme | null> => {
  const docRef = doc(db, "themes", id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToTheme(snapshot) : null;
};

/**
 * 새 테마를 추가하고 문서 ID를 반환합니다.
 * @param themeData - 새로 추가할 테마의 데이터 (ID, createdAt, updatedAt 제외)
 * @returns {Promise<string>} 새로 생성된 테마의 문서 ID
 */
export const addTheme = async (
  themeData: Omit<Theme, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(themesCollection, {
    ...themeData,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

/**
 * 특정 ID의 테마 정보를 업데이트합니다.
 * 미디어 파일(R2)이 변경되거나 제거되면 이전 파일을 삭제합니다.
 * @param id - 업데이트할 테마의 ID
 * @param themeData - 업데이트할 테마의 부분 데이터 (ID, createdAt 제외)
 * @returns {Promise<void>}
 */
export const updateTheme = async (
  id: string,
  themeData: Partial<Omit<Theme, "id" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", id);
  const existingTheme = await getTheme(id);

  // 기존 테마 데이터가 있는 경우, 미디어 키를 비교하여 R2 객체 삭제 로직 수행
  if (existingTheme) {
    const oldKeys = [
      existingTheme.thumbnailKey,
      existingTheme.openingVideoKey,
      existingTheme.openingBgmKey,
      existingTheme.openingImageKey,
    ];
    const newKeys = [
      themeData.thumbnailKey,
      themeData.openingVideoKey,
      themeData.openingBgmKey,
      themeData.openingImageKey,
    ];

    // 이전 키가 존재하고, 새 키와 다를 경우 (즉, 교체되거나 제거된 경우) R2 삭제 API 호출
    const checkAndDelete = async (oldKey: string | null | undefined, newKey: string | null | undefined) => {
      if (typeof oldKey === 'string' && oldKey.length > 0 && oldKey !== newKey) {
        try {
          await callR2DeleteApi(oldKey);
        } catch (error) {
          console.warn(`테마 업데이트 중 이전 R2 객체 ${oldKey} 삭제 실패:`, error);
        }
      }
    };

    // 모든 미디어 키에 대해 확인 및 삭제 로직 반복
    for (let i = 0; i < oldKeys.length; i++) {
      await checkAndDelete(oldKeys[i], newKeys[i]);
    }
  }
  
  // Firestore 문서 업데이트
  await updateDoc(docRef, {
    ...themeData,
    updatedAt: Timestamp.now(),
  });
};

/**
 * 특정 ID의 테마와 관련된 모든 하위 문제, R2 미디어 파일을 삭제합니다.
 * @param id - 삭제할 테마의 ID
 * @returns {Promise<void>}
 */
export const deleteTheme = async (id: string): Promise<void> => {
  const theme = await getTheme(id); // 삭제할 테마 정보 가져오기

  if (theme) {
    // 1. 모든 하위 문제와 해당 미디어 파일 삭제 (deleteProblem 재사용)
    const problems = await getProblemsByTheme(id);
    for (const problem of problems) {
      try {
        await deleteProblem(id, problem.id); // 개별 문제 삭제 (문제 미디어도 삭제됨)
      } catch (error) {
        console.warn(`테마 삭제 중 문제 ${problem.id} 삭제 실패:`, error);
        // 실패하더라도 테마 문서 삭제는 계속 진행
      }
    }

    // 2. 테마 자체의 R2 객체 삭제
    const mediaKeys = [theme.thumbnailKey, theme.openingVideoKey, theme.openingBgmKey, theme.openingImageKey];
    for (const key of mediaKeys) {
      if (key) {
        try {
          await callR2DeleteApi(key);
        } catch (error) {
          console.warn(`테마 ${id}의 R2 객체 ${key} 삭제 실패:`, error);
          // 실패하더라도 Firestore 문서 삭제는 계속 진행
        }
      }
    }
  }

  // 3. Firestore 테마 문서 삭제
  const docRef = doc(db, "themes", id);
  await deleteDoc(docRef);
};

// --- Problem CRUD (생성, 조회, 수정, 삭제) 작업 ---

// 특정 테마 ID의 'problems' 서브컬렉션 참조를 가져오는 헬퍼 함수
// 특정 테마 ID의 'problems' 서브컬렉션 참조를 가져오는 헬퍼 함수
// @param themeId - 문제를 가져올 테마의 ID
// @returns 'problems' 서브컬렉션에 대한 참조
const getProblemsSubCollection = (themeId: string) =>
  collection(db, "themes", themeId, "problems");

/**
 * 특정 테마에 속한 모든 문제를 가져옵니다. (번호 순 오름차순 정렬)
 * @param themeId - 문제를 가져올 테마의 ID
 * @returns {Promise<Problem[]>} 해당 테마의 모든 문제 객체 배열
 */
export const getProblemsByTheme = async (themeId: string): Promise<Problem[]> => {
  const q = query(getProblemsSubCollection(themeId), orderBy("number", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProblem);
};

/**
 * 특정 테마 내 특정 ID의 문제를 가져옵니다.
 * @param themeId - 문제가 속한 테마의 ID
 * @param problemId - 가져올 문제의 ID
 * @returns {Promise<Problem | null>} 해당 문제 객체 또는 찾을 수 없는 경우 null
 */
export const getProblem = async (themeId: string, problemId: string): Promise<Problem | null> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToProblem(snapshot) : null;
};

/**
 * 특정 테마에 새 문제를 추가하고 문서 ID를 반환합니다.
 * 'triggers' 필드가 없을 경우 빈 배열로 초기화됩니다.
 * @param themeId - 문제가 속할 테마의 ID
 * @param problemData - 새로 추가할 문제의 데이터 (ID, themeId, createdAt, updatedAt 제외)
 * @returns {Promise<string>} 새로 생성된 문제의 문서 ID
 */
export const addProblem = async (
  themeId: string,
  problemData: Omit<Problem, "id" | "themeId" | "createdAt" | "updatedAt">
): Promise<string> => {
  const now = Timestamp.now();
  // Ensure that triggers are stored as an array, even if empty
  const dataToSave = {
    ...problemData,
    themeId: themeId,
    triggers: problemData.triggers || [], // 'triggers' 필드가 없을 경우 빈 배열로 초기화
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(getProblemsSubCollection(themeId), dataToSave);
  return docRef.id;
};

/**
 * 특정 문제를 업데이트합니다.
 * 문제의 미디어 파일(R2)이 변경되거나 제거되면 이전 파일을 삭제합니다.
 * 'triggers' 필드가 없을 경우 빈 배열로 초기화됩니다.
 * @param themeId - 문제가 속한 테마의 ID
 * @param problemId - 업데이트할 문제의 ID
 * @param problemData - 업데이트할 문제의 부분 데이터 (ID, themeId, createdAt 제외)
 * @returns {Promise<void>}
 */
export const updateProblem = async (
  themeId: string,
  problemId: string,
  problemData: Partial<Omit<Problem, "id" | "themeId" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  const existingProblem = await getProblem(themeId, problemId);

  // Helper to check and delete old R2 keys for a given ProblemMedia object
  const checkAndDeleteMediaKeys = async (oldMedia: ProblemMedia | null | undefined, newMedia: ProblemMedia | null | undefined) => {
    // 모든 키를 한 번에 처리
    const mediaKeys = ['imageKey', 'videoKey', 'bgmKey'] as const;
    for (const key of mediaKeys) {
      const oldKey = oldMedia?.[key];
      const newKey = newMedia?.[key];
      if (typeof oldKey === 'string' && oldKey.length > 0 && oldKey !== newKey) {
        try {
          await callR2DeleteApi(oldKey);
        } catch (error) {
          console.warn(`문제 업데이트 중 이전 R2 객체 ${oldKey} 삭제 실패:`, error);
        }
      }
    }
  };

  // 1. 로컬 미디어 (problem.media)에 대해 R2 객체 삭제 로직 수행
  await checkAndDeleteMediaKeys(existingProblem?.media, problemData.media);

  // 2. 트리거 배열 내 미디어 (problem.triggers)에 대해 R2 객체 삭제 로직 수행
  const oldTriggers = existingProblem?.triggers || [];
  const newTriggers = problemData.triggers || [];

  // 변경되거나 삭제된 이전 트리거 미디어 키 삭제
  oldTriggers.forEach(async (oldTrigger) => {
    const newTrigger = newTriggers.find(nt => nt.targetDevice === oldTrigger.targetDevice);
    if (newTrigger) { // targetDevice가 일치하는 새 트리거가 있으면 미디어 키 비교
      await checkAndDeleteMediaKeys(oldTrigger.mediaState, newTrigger.mediaState);
    } else { // targetDevice가 일치하는 새 트리거가 없으면 (즉, 트리거 자체가 삭제됨) 이전 미디어 모두 삭제
      await checkAndDeleteMediaKeys(oldTrigger.mediaState, null);
    }
  });


  // Firestore 문서 업데이트
  await updateDoc(docRef, {
    ...problemData,
    updatedAt: Timestamp.now(),
    triggers: problemData.triggers || [], // 'triggers' 필드가 없을 경우 빈 배열로 초기화
  });
};

/**
 * 특정 문제를 삭제하고, 문제에 연결된 R2 미디어 파일도 삭제합니다.
 * @param themeId - 문제가 속한 테마의 ID
 * @param problemId - 삭제할 문제의 ID
 * @returns {Promise<void>}
 */
export const deleteProblem = async (themeId: string, problemId: string): Promise<void> => {
  const problem = await getProblem(themeId, problemId); // 삭제할 문제 정보 가져오기

  if (problem) {
    const mediaKeysToDelete: (string | null | undefined)[] = [];
    // 1. 로컬 미디어 (problem.media) R2 객체 키 추가
    if (problem.media) {
      mediaKeysToDelete.push(problem.media.imageKey, problem.media.videoKey, problem.media.bgmKey);
    }

    // 2. 트리거 배열 내 미디어 (problem.triggers) R2 객체 키 추가
    problem.triggers?.forEach((trigger) => {
      mediaKeysToDelete.push(trigger.mediaState.imageKey, trigger.mediaState.videoKey, trigger.mediaState.bgmKey);
    });

    // 모든 키에 대해 삭제 API 호출
    for (const key of mediaKeysToDelete) {
      await callR2DeleteApi(key); // callR2DeleteApi 내에서 null/undefined 체크
    }
  }

  // Firestore 문서 삭제
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  await deleteDoc(docRef);
};

/**
 * 특정 테마에 속한 문제의 총 개수를 가져옵니다.
 * @param themeId - 문제 개수를 가져올 테마의 ID
 * @returns {Promise<number>} 해당 테마의 총 문제 개수
 */
export const getProblemCountByTheme = async (themeId: string): Promise<number> => {
  const q = query(getProblemsSubCollection(themeId));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

/**
 * 문제 순서(number 필드)를 일괄적으로 업데이트합니다. (Firestore Batch 사용)
 * @param themeId - 문제가 속한 테마의 ID
 * @param problemUpdates - { id: 문제 ID, number: 새 순서 } 객체 배열
 * @returns {Promise<void>}
 */
export const updateProblemOrder = async (
  themeId: string,
  problemUpdates: { id: string; number: number }[]
): Promise<void> => {
  const batch = writeBatch(db); // 쓰기 배치 시작
  problemUpdates.forEach((update) => {
    const problemRef = doc(db, "themes", themeId, "problems", update.id);
    batch.update(problemRef, { number: update.number, updatedAt: Timestamp.now() });
  });
  await batch.commit(); // 배치 작업 커밋
};

// --- 헬퍼 함수: 트리거 미디어 상태 적용 ---
/**
 * 주어진 ProblemMedia를 ConnectedDevice의 currentPersistentMedia에 적용합니다.
 * - videoKey, imageKey, text, bgmKey는 주어진 값으로 덮어쓰거나, undefined/null이면 클리어합니다.
 * @param currentMedia - 현재 장치의 currentPersistentMedia (기존 상태)
 * @param mediaState - 적용할 ProblemMedia (트리거에서 전달받은 미디어 상태)
 * @returns {ConnectedDevice['currentPersistentMedia']} 업데이트된 currentPersistentMedia 객체
 */
export const applyTriggerMediaState = (
  currentMedia: ConnectedDevice['currentPersistentMedia'],
  mediaState: ProblemMedia
): ConnectedDevice['currentPersistentMedia'] => {
  return {
    imageKey: mediaState.imageKey !== undefined ? mediaState.imageKey : null,
    videoKey: mediaState.videoKey !== undefined ? mediaState.videoKey : null,
    bgmKey: mediaState.bgmKey !== undefined ? mediaState.bgmKey : null,
    text: mediaState.text !== undefined ? mediaState.text : null,
  };
};


/**
 * 문제가 해결되었을 때 GameState를 업데이트하는 핵심 로직.
 * 현재 상태 위에 해결된 문제의 트리거만 덮어쓰는 효율적인 방식을 사용합니다.
 * @param sessionId - 현재 게임 세션 ID
 * @param solvedProblem - 해결된 문제의 Problem 객체
 * @param solvingDeviceId - 문제를 해결한 장치의 ID
 * @param allProblems - 해당 테마의 모든 문제 목록 (다음 문제 번호 결정을 위함)
 * @returns {Promise<void>}
 */
export const updateGameStateWithProblemSolution = async (
  sessionId: string,
  solvedProblem: Problem,
  solvingDeviceId: string,
  allProblems: Problem[]
): Promise<void> => {
  const gameStateRef = doc(db, "gameSessions", sessionId);
  const gameStateSnap = await getDoc(gameStateRef);

  if (!gameStateSnap.exists()) {
    throw new Error(`게임 세션 ${sessionId}를 찾을 수 없습니다.`);
  }

  const currentGameState = docToGameStateFromDocumentSnapshot({ id: gameStateSnap.id, ...gameStateSnap.data() });
  const now = Timestamp.now();

  const updatedSolvedProblems = {
    ...currentGameState.solvedProblems,
    [solvedProblem.code]: now,
  };

  const updatedConnectedDevices = { ...currentGameState.connectedDevices };

  // 1. 로컬 트리거 (문제 푼 장치) 적용
  if (solvedProblem.media && updatedConnectedDevices[solvingDeviceId]) {
    updatedConnectedDevices[solvingDeviceId].currentPersistentMedia = applyTriggerMediaState(
      updatedConnectedDevices[solvingDeviceId].currentPersistentMedia,
      solvedProblem.media
    );
  }

  // 2. 원격/추가 트리거 적용
  if (solvedProblem.triggers) {
    solvedProblem.triggers.forEach(trigger => {
      // 대상 장치가 없으면 새로 생성
      if (!updatedConnectedDevices[trigger.targetDevice]) {
        updatedConnectedDevices[trigger.targetDevice] = {
            status: 'disconnected',
            lastSeen: now,
            currentPersistentMedia: {...defaultCurrentPersistentMedia}
        }
      }
      updatedConnectedDevices[trigger.targetDevice].currentPersistentMedia = applyTriggerMediaState(
        updatedConnectedDevices[trigger.targetDevice].currentPersistentMedia,
        trigger.mediaState
      );
    });
  }

  // 3. 다음 문제 번호 결정
  const nextProblem = allProblems
    .filter(p => p.number > solvedProblem.number && p.type === 'trigger')
    .sort((a, b) => a.number - b.number)[0];
  
  const updatedCurrentProblemNumber = nextProblem ? nextProblem.number : solvedProblem.number + 1;

  let newStatus: GameState['status'] = currentGameState.status;

  // 다음 트리거 문제가 없으면 게임을 종료 상태로 변경
  if (!nextProblem) {
    newStatus = 'ended';
  }

  await updateDoc(gameStateRef, {
    solvedProblems: updatedSolvedProblems,
    connectedDevices: updatedConnectedDevices,
    currentProblemNumber: updatedCurrentProblemNumber,
    status: newStatus,
    updatedAt: now,
  });
};

/**
 * 특정 게임 세션 문서를 Firestore에서 영구적으로 삭제합니다.
 * @param sessionId - 삭제할 게임 세션 ID
 * @returns {Promise<void>}
 */
export const deleteGameSession = async (sessionId: string): Promise<void> => {
  const docRef = doc(db, "gameSessions", sessionId);
  await deleteDoc(docRef);
};


// 비디오 강제 재생을 위한 헬퍼 함수
// 비디오 키에 타임스탬프 쿼리 매개변수를 추가하여 클라이언트에서 비디오를 다시 로드하고 재생하도록 유도합니다.
// @param videoKey - 원본 비디오 키
// @returns {string | null} 재재생을 위한 쿼리 매개변수가 추가된 비디오 키 또는 null
const _forceVideoReplayKey = (videoKey: string | null | undefined): string | null => {
  if (!videoKey) return null;
  const baseKey = videoKey.split('?')[0];
  return `${baseKey}?resync=${Timestamp.now().toMillis()}`;
};


/**
 * GameState를 특정 문제 번호 시점으로 재구성합니다.
 * 'JUMP TO PROBLEM' 기능에 사용됩니다.
 * @param sessionId - 현재 게임 세션 ID
 * @param targetProblemNumber - 재구성할 목표 문제 번호 (이 번호 직전까지의 상태로 만듦)
 * @param themeId - 기반 테마 ID
 * @returns {Promise<Partial<GameState>>} 재구성된 GameState 데이터 (Firestore 업데이트용)
 */
export const reconstructGameStateForJump = async (
  sessionId: string,
  targetProblemNumber: number,
  themeId: string,
): Promise<Partial<GameState>> => {
  const [allProblems, theme, currentGameState] = await Promise.all([
    getProblemsByTheme(themeId),
    getTheme(themeId),
    getGameState(sessionId),
  ]);

  if (!theme) {
    throw new Error(`Theme with id ${themeId} not found.`);
  }

  const now = Timestamp.now();
  const reconstructedSolvedProblems: { [problemCode: string]: Timestamp | null } = {};

  // Step 1: Define the opening media state for the default device
  const openingMediaState: ConnectedDevice['currentPersistentMedia'] = {
    videoKey: theme.openingVideoKey ?? null,
    imageKey: theme.openingImageKey ?? null,
    text: theme.openingText ?? null,
    bgmKey: theme.openingBgmKey ?? null,
  };

  // Step 2: Initialize devices. Default device gets opening media, others get null media.
  const initialConnectedDevices: { [deviceId: string]: ConnectedDevice } = {};
  const defaultDeviceID = '기본장치';
  if (currentGameState) {
    for (const deviceId in currentGameState.connectedDevices) {
      if (Object.prototype.hasOwnProperty.call(currentGameState.connectedDevices, deviceId)) {
        initialConnectedDevices[deviceId] = {
          ...currentGameState.connectedDevices[deviceId],
          currentPersistentMedia: deviceId === defaultDeviceID 
            ? { ...openingMediaState } 
            : { ...defaultCurrentPersistentMedia },
        };
      }
    }
  }

  // Step 3: Filter problems to simulate and sort them
  const problemsToSimulate = allProblems
    .filter((p) => p.number < targetProblemNumber && p.type === 'trigger')
    .sort((a, b) => a.number - b.number);

  // Step 4: Simulate solving each problem, layering its media state on top
  for (const problem of problemsToSimulate) {
    reconstructedSolvedProblems[problem.code] = now;

    // Apply local trigger
    if (problem.media && problem.device && initialConnectedDevices[problem.device]) {
      initialConnectedDevices[problem.device].currentPersistentMedia = applyTriggerMediaState(
        initialConnectedDevices[problem.device].currentPersistentMedia,
        problem.media
      );
    }

    // Apply remote triggers
    if (problem.triggers) {
      problem.triggers.forEach(trigger => {
        if (initialConnectedDevices[trigger.targetDevice]) {
          initialConnectedDevices[trigger.targetDevice].currentPersistentMedia = applyTriggerMediaState(
            initialConnectedDevices[trigger.targetDevice].currentPersistentMedia,
            trigger.mediaState
          );
        }
      });
    }
  }
  
  // Step 5: Determine the next problem number
  const nextTriggerProblem = allProblems
    .filter(p => p.number >= targetProblemNumber && p.type === 'trigger')
    .sort((a, b) => a.number - b.number)[0];
  
  const updatedCurrentProblemNumber = nextTriggerProblem ? nextTriggerProblem.number : targetProblemNumber;

  return {
    currentProblemNumber: updatedCurrentProblemNumber,
    solvedProblems: reconstructedSolvedProblems,
    connectedDevices: initialConnectedDevices,
    updatedAt: now,
  };
};

/**
 * 현재 게임 상태를 모든 장치에 강제로 다시 동기화합니다.
 * 특히, 현재 영상이 있는 장치는 영상을 다시 재생하도록 `resync` 쿼리 파라미터가 추가됩니다.
 * @param sessionId - 재동기화할 게임 세션 ID
 * @returns {Promise<void>}
 */
export const resynchronizeGameState = async (sessionId: string): Promise<void> => {
  const gameState = await getGameState(sessionId);
  if (!gameState) {
    throw new Error(`Game session ${sessionId} not found.`);
  }

  const updatedConnectedDevices = { ...gameState.connectedDevices };
  
  // 모든 연결된 장치를 순회
  for (const deviceId in updatedConnectedDevices) {
    if (Object.prototype.hasOwnProperty.call(updatedConnectedDevices, deviceId)) {
      const device = updatedConnectedDevices[deviceId];
      // 현재 비디오 키가 있는 경우, 키를 변경하여 클라이언트에서 재재생을 유도
      if (device.currentPersistentMedia.videoKey) {
        // 기존 키에서 쿼리 매개변수 제거 후 새로 추가
        const baseKey = device.currentPersistentMedia.videoKey.split('?')[0];
        device.currentPersistentMedia.videoKey = `${baseKey}?resync=${Date.now()}`;
      }
    }
  }

  // 변경된 장치 상태로 게임 상태 업데이트
  await updateDoc(doc(db, "gameSessions", sessionId), {
    connectedDevices: updatedConnectedDevices,
    updatedAt: Timestamp.now(),
  });
};

/**
 * 새 게임 세션을 생성하고 문서 ID를 반환합니다.
 * 시작 문제 번호는 테마의 첫 번째 트리거 문제 번호로 설정됩니다.
 * @param themeId - 기반 테마 ID
 * @param gameCode - 관리자가 지정한 짧은 게임 코드
 * @returns {Promise<string>} 생성된 세션 ID
 */
export const createNewGameSession = async (themeId: string, gameCode: string): Promise<string> => {
  const now = Timestamp.now();
  
  // Get all problems for the theme to find the first trigger problem
  const problems = await getProblemsByTheme(themeId); // Assuming getProblemsByTheme is available
  const firstTriggerProblem = problems
    .filter(p => p.type === 'trigger')
    .sort((a, b) => a.number - b.number)[0];

  // Set the starting problem number to the first trigger problem's number, or 1 as a fallback.
  const startingProblemNumber = firstTriggerProblem ? firstTriggerProblem.number : 1;

  const docRef = await addDoc(gameSessionsCollection, {
    themeId,
    status: 'pending', // 초기 상태는 대기(pending)
    gameCode,
    solvedProblems: {},
    connectedDevices: {},
    currentProblemNumber: startingProblemNumber,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

/**
 * 게임 세션을 시작하고, 기본 장치에 테마의 오프닝 미디어를 적용합니다.
 * 이때 비디오가 있다면 강제 재생을 위해 `resync` 쿼리 파라미터가 추가됩니다.
 * @param sessionId - 시작할 게임 세션 ID
 * @param themeId - 세션의 테마 ID
 * @returns {Promise<void>}
 */
export const startGameSession = async (sessionId: string, themeId: string): Promise<void> => {
  const now = Timestamp.now();
  const gameStateRef = doc(db, "gameSessions", sessionId);
  
  // Get existing game state and theme data
  const gameStateSnap = await getDoc(gameStateRef);
  if (!gameStateSnap.exists()) {
    throw new Error(`게임 세션 ${sessionId}를 찾을 수 없습니다.`);
  }
  const currentGameState = docToGameStateFromDocumentSnapshot({ id: gameStateSnap.id, ...gameStateSnap.data() });

  const theme = await getTheme(themeId); // Assuming getTheme is available
  if (!theme) {
    throw new Error(`테마 ${themeId}를 찾을 수 없습니다.`);
  }

  const updatedConnectedDevices = { ...currentGameState.connectedDevices };
  const defaultDeviceID = '기본장치'; // As per design, default device is '기본장치'

  // Ensure the default device exists in connectedDevices and apply opening media
  if (!updatedConnectedDevices[defaultDeviceID]) {
    updatedConnectedDevices[defaultDeviceID] = {
      status: 'disconnected', // Default status if not yet connected
      lastSeen: now,
      currentPersistentMedia: { ...defaultCurrentPersistentMedia }, // Initialize if new
    };
  }

  // Apply theme's opening media to the default device, forcing video replay
  updatedConnectedDevices[defaultDeviceID].currentPersistentMedia = {
    ...updatedConnectedDevices[defaultDeviceID].currentPersistentMedia,
    videoKey: _forceVideoReplayKey(theme.openingVideoKey),
    imageKey: theme.openingImageKey ?? null,
    text: theme.openingText ?? null,
    bgmKey: theme.openingBgmKey ?? null,
  };

  await updateDoc(gameStateRef, {
    status: 'running',
    connectedDevices: updatedConnectedDevices,
    updatedAt: now,
  });
};

/**
 * gameCode를 사용하여 게임 세션을 찾습니다.
 * gameCode는 고유하다고 가정하며, 첫 번째로 발견된 세션을 반환합니다.
 * @param gameCode - 찾을 게임 코드
 * @returns {Promise<GameState | null>} GameState 객체 또는 찾을 수 없는 경우 null
 */
export const findSessionByGameCode = async (gameCode: string): Promise<GameState | null> => {
  const q = query(gameSessionsCollection, where("gameCode", "==", gameCode));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // gameCode는 고유해야 하므로 첫 번째 문서만 가져옴
    const doc = snapshot.docs[0];
    return docToGameStateFromDocumentSnapshot({ id: doc.id, ...doc.data() });
  }
  return null;
};


/**
 * 특정 ID의 게임 세션 상태를 실시간으로 구독합니다.
 * @param sessionId - 세션 ID
 * @param callback - 실시간 데이터 변경 시 호출될 함수 (GameState 객체 또는 null을 인자로 받음)
 * @returns {() => void} 구독 해제 함수 (unsubscribe function)
 */
export const subscribeToGameState = (
  sessionId: string,
  callback: (gameState: GameState | null) => void
) => {
  const docRef = doc(db, "gameSessions", sessionId);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const gameState: GameState = docToGameStateFromDocumentSnapshot({ id: snapshot.id, ...snapshot.data() }); // id 포함
      callback(gameState);
    } else {
      callback(null);
    }
  });
};

/**
 * 모든 게임 세션 목록을 실시간으로 구독합니다. (생성일 기준 내림차순 정렬)
 * @param callback - 실시간 데이터 변경 시 호출될 함수 (GameState 객체 배열을 인자로 받음)
 * @returns {() => void} 구독 해제 함수 (unsubscribe function)
 */
export const subscribeToGameSessions = (
  callback: (gameStates: GameState[]) => void
) => {
  const q = query(gameSessionsCollection, orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const gameStates: GameState[] = snapshot.docs.map(docToGameState);
    callback(gameStates);
  });
};


/**
 * 특정 ID의 게임 세션 상태를 한 번 가져옵니다.
 * @param sessionId - 가져올 게임 세션의 ID
 * @returns {Promise<GameState | null>} GameState 객체 또는 찾을 수 없는 경우 null
 */
export const getGameState = async (sessionId: string): Promise<GameState | null> => {
  const docRef = doc(db, "gameSessions", sessionId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToGameStateFromDocumentSnapshot({ id: snapshot.id, ...snapshot.data() }) : null; // id 포함
};

/**
 * 게임 세션 상태를 업데이트합니다. (예: status 변경, 장치 연결 상태 변경 등)
 * @param sessionId - 세션 ID
 * @param updateData - 업데이트할 필드 데이터 (ID, createdAt 제외)
 * @returns {Promise<void>}
 */
export const updateGameState = async (
  sessionId: string,
  updateData: Partial<Omit<GameState, 'id' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, "gameSessions", sessionId);
  await updateDoc(docRef, {
    ...updateData,
    updatedAt: Timestamp.now(),
  });
};