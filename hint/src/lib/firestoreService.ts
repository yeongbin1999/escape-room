/**
 * 이 파일은 Firestore 데이터베이스의 'themes' 및 'problems' 컬렉션에 대한
 * 모든 CRUD(Create, Read, Update, Delete) 작업을 중앙 집중화하여 관리합니다.
 * 또한, 테마나 문제 삭제 시 연결된 Cloudflare R2 객체(미디어 파일)도 함께 삭제하는 로직을 포함하여
 * 데이터 일관성을 유지하고 불필요한 스토리지 사용을 방지합니다.
 *
 * 주요 기능:
 * - 테마 및 문제 데이터의 조회, 추가, 수정, 삭제.
 * - Firestore 문서 스냅샷을 애플리케이션의 타입 정의에 맞는 객체로 변환.
 * - R2에 저장된 미디어 파일의 안전한 삭제를 위한 API 호출.
 * - 여러 Firestore 쓰기 작업을 효율적으로 처리하는 배치(Batch) 업데이트.
 */
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
} from "firebase/firestore";

import type {
  Theme,
  Problem,
  ProblemMedia,
  ProblemType,
} from "@/types/dbTypes";

// --- Firestore 서비스 주요 컬렉션 참조 ---

const themesCollection = collection(db, "themes");
// 'problems' 컬렉션은 'themes' 컬렉션의 하위 컬렉션으로 존재하므로, 동적으로 참조를 얻습니다.


// --- Firestore 문서 변환 헬퍼 함수 ---

/**
 * Firestore 문서 스냅샷을 Theme 타입 객체로 변환합니다.
 * @param doc Firestore의 테마 문서 스냅샷.
 * @returns Theme 타입 객체.
 */
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
});

/**
 * Firestore 문서 스냅샷을 Problem 타입 객체로 변환합니다.
 * @param doc Firestore의 문제 문서 스냅샷.
 * @returns Problem 타입 객체.
 */
const docToProblem = (doc: QueryDocumentSnapshot<DocumentData>): Problem => ({
  id: doc.id,
  themeId: doc.data().themeId,
  number: doc.data().number,
  title: doc.data().title,
  type: doc.data().type,
  code: doc.data().code,
  media: doc.data().media,
  hints: doc.data().hints,
  solution: doc.data().solution,
  createdAt: doc.data().createdAt,
  updatedAt: doc.data().updatedAt,
});


// --- R2 객체 삭제 헬퍼 함수 ---

/**
 * Cloudflare R2에 저장된 객체(미디어 파일)를 삭제하기 위해 서버의 API 엔드포인트를 호출합니다.
 * 직접 R2에 접근하는 대신 서버를 통해 삭제를 요청하여 보안을 강화합니다.
 * @param key 삭제할 R2 객체의 키 (파일 경로).
 */
const callR2DeleteApi = async (key: string): Promise<void> => {
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
      throw new Error(errorData.error || 'Failed to delete R2 object via API');
    }
  } catch (error) {
    console.error(`R2 삭제 API 호출 중 에러 발생 (키: ${key}):`, error);
    throw error;
  }
};


// --- 테마(Theme) CRUD 작업 ---

/**
 * 모든 테마 목록을 최신 생성일 기준으로 내림차순으로 조회합니다.
 * @returns Theme 타입 객체 배열.
 */
export const getThemes = async (): Promise<Theme[]> => {
  const q = query(themesCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToTheme);
};

/**
 * 특정 ID를 가진 테마를 조회합니다.
 * @param id 조회할 테마의 ID.
 * @returns Theme 타입 객체 또는 해당 ID의 테마가 없으면 `null`.
 */
export const getTheme = async (id: string): Promise<Theme | null> => {
  const docRef = doc(db, "themes", id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToTheme(snapshot) : null;
};

/**
 * 새로운 테마를 Firestore에 추가합니다.
 * @param themeData 새로운 테마의 데이터 (ID, createdAt, updatedAt 제외).
 * @returns 새로 생성된 테마 문서의 ID.
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
 * 특정 ID를 가진 테마의 데이터를 업데이트합니다.
 * @param id 업데이트할 테마의 ID.
 * @param themeData 업데이트할 테마 데이터의 부분 집합 (ID, createdAt 제외).
 */
export const updateTheme = async (
  id: string,
  themeData: Partial<Omit<Theme, "id" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", id);
  await updateDoc(docRef, {
    ...themeData,
    updatedAt: Timestamp.now(),
  });
};

/**
 * 특정 ID를 가진 테마와 연결된 모든 문제 및 R2 객체를 삭제한 후 테마를 삭제합니다.
 * 이는 종속된 데이터를 먼저 삭제하여 데이터 무결성을 보장하는 '캐스케이딩 삭제' 로직입니다.
 * @param id 삭제할 테마의 ID.
 */
export const deleteTheme = async (id: string): Promise<void> => {
  const theme = await getTheme(id); // 미디어 키를 얻기 위해 테마 정보를 가져옵니다.

  if (theme) {
    // 테마를 삭제하기 전에 연결된 모든 문제와 그 문제들의 R2 객체를 삭제합니다.
    const problems = await getProblemsByTheme(id);
    for (const problem of problems) {
      try {
        await deleteProblem(id, problem.id);
      } catch (error) {
        console.warn(`테마 삭제 중 문제 ${problem.id} 삭제 실패 (테마 ID: ${id}):`, error);
        // 문제 삭제 실패하더라도 테마 삭제는 계속 진행합니다.
      }
    }

    // 테마 자체에 연결된 R2 객체들을 삭제합니다.
    const mediaKeys = [theme.thumbnailKey, theme.openingVideoKey, theme.openingBgmKey, theme.openingImageKey];
    for (const key of mediaKeys) {
      if (key) {
        try {
          await callR2DeleteApi(key);
        } catch (error) {
          console.warn(`테마 ${id}의 R2 객체 ${key} 삭제 실패:`, error);
          // R2 삭제 실패하더라도 Firestore 삭제는 계속 진행합니다.
        }
      }
    }
  }

  // Firestore에서 테마 문서를 삭제합니다.
  const docRef = doc(db, "themes", id);
  await deleteDoc(docRef);
};

// --- 문제(Problem) CRUD 작업 ---

/**
 * 특정 테마의 하위 컬렉션인 'problems' 컬렉션에 대한 참조를 가져오는 헬퍼 함수입니다.
 * @param themeId 문제를 조회할 테마의 ID.
 * @returns 'problems' 하위 컬렉션 참조.
 */
const getProblemsSubCollection = (themeId: string) =>
  collection(db, "themes", themeId, "problems");

/**
 * 특정 테마에 속한 모든 문제 목록을 문제 번호(number) 기준으로 오름차순으로 조회합니다.
 * @param themeId 문제를 조회할 테마의 ID.
 * @returns Problem 타입 객체 배열.
 */
export const getProblemsByTheme = async (themeId: string): Promise<Problem[]> => {
  const q = query(getProblemsSubCollection(themeId), orderBy("number", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProblem);
};

/**
 * 특정 테마에 속한 특정 ID의 문제를 조회합니다.
 * @param themeId 문제를 조회할 테마의 ID.
 * @param problemId 조회할 문제의 ID.
 * @returns Problem 타입 객체 또는 해당 ID의 문제가 없으면 `null`.
 */
export const getProblem = async (themeId: string, problemId: string): Promise<Problem | null> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToProblem(snapshot) : null;
};

/**
 * 특정 테마에 새로운 문제를 추가합니다.
 * @param themeId 문제를 추가할 테마의 ID.
 * @param problemData 새로운 문제의 데이터 (ID, themeId, createdAt, updatedAt 제외).
 * @returns 새로 생성된 문제 문서의 ID.
 */
export const addProblem = async (
  themeId: string,
  problemData: Omit<Problem, "id" | "themeId" | "createdAt" | "updatedAt">
): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(getProblemsSubCollection(themeId), {
    ...problemData,
    themeId: themeId,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

/**
 * 특정 테마에 속한 특정 ID의 문제 데이터를 업데이트합니다.
 * @param themeId 업데이트할 문제가 속한 테마의 ID.
 * @param problemId 업데이트할 문제의 ID.
 * @param problemData 업데이트할 문제 데이터의 부분 집합 (ID, themeId, createdAt 제외).
 */
export const updateProblem = async (
  themeId: string,
  problemId: string,
  problemData: Partial<Omit<Problem, "id" | "themeId" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  await updateDoc(docRef, {
    ...problemData,
    updatedAt: Timestamp.now(),
  });
};

/**
 * 특정 테마에 속한 특정 ID의 문제를 삭제하고, 연결된 R2 객체(미디어 파일)도 함께 삭제합니다.
 * @param themeId 삭제할 문제가 속한 테마의 ID.
 * @param problemId 삭제할 문제의 ID.
 */
export const deleteProblem = async (themeId: string, problemId: string): Promise<void> => {
  const problem = await getProblem(themeId, problemId); // 미디어 키를 얻기 위해 문제 정보를 가져옵니다.

  if (problem && problem.media) {
    // 문제에 연결된 R2 객체들을 삭제합니다.
    const mediaKeys = [problem.media.imageKey, problem.media.videoKey, problem.media.bgmKey];
    for (const key of mediaKeys) {
      if (key) {
        try {
          await callR2DeleteApi(key);
        } catch (error) {
          console.warn(`문제 ${problemId}의 R2 객체 ${key} 삭제 실패:`, error);
          // R2 삭제 실패하더라도 Firestore 삭제는 계속 진행합니다.
        }
      }
    }
  }

  // Firestore에서 문제 문서를 삭제합니다.
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  await deleteDoc(docRef);
};

/**
 * 특정 테마에 속한 문제의 총 개수를 조회합니다.
 * @param themeId 문제 개수를 조회할 테마의 ID.
 * @returns 해당 테마에 속한 문제의 개수.
 */
export const getProblemCountByTheme = async (themeId: string): Promise<number> => {
  const q = query(getProblemsSubCollection(themeId));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

/**
 * 특정 테마에 속한 문제들의 순서(number 필드)를 일괄 업데이트합니다.
 * Firestore의 배치 쓰기(batch write) 기능을 사용하여 여러 업데이트를 하나의 원자적 작업으로 처리하여 효율성을 높입니다.
 * @param themeId 문제가 속한 테마의 ID.
 * @param problemUpdates 문제 ID와 새로운 순서 번호를 포함하는 객체 배열.
 */
export const updateProblemOrder = async (
  themeId: string,
  problemUpdates: { id: string; number: number }[]
): Promise<void> => {
  const batch = writeBatch(db);
  problemUpdates.forEach((update) => {
    const problemRef = doc(db, "themes", themeId, "problems", update.id);
    batch.update(problemRef, { number: update.number, updatedAt: Timestamp.now() });
  });
  await batch.commit();
};
