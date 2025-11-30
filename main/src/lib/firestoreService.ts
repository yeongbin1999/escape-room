import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  getDocs,
  getDoc, // Added getDoc for fetching theme before deletion
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch, // Added writeBatch
} from "firebase/firestore";

import type {
  Theme,
  Problem,
  ProblemMedia,
  ProblemType,
} from "@/types/dbTypes";



// --- Firestore Service ---

const themesCollection = collection(db, "themes");
// Problems will now be subcollections of themes, so we'll get the collection dynamically

// Helper to convert Firestore document to Theme/Problem interface
const docToTheme = (doc: QueryDocumentSnapshot<DocumentData>): Theme => ({
  id: doc.id,
  title: doc.data().title,
  description: doc.data().description,
  createdAt: doc.data().createdAt,
  updatedAt: doc.data().updatedAt,
  openingVideoKey: doc.data().openingVideoKey,
  openingBgmKey: doc.data().openingBgmKey,
  openingImageKey: doc.data().openingImageKey, // Include openingImageKey
  openingText: doc.data().openingText,         // Include openingText
  thumbnailKey: doc.data().thumbnailKey,
  isActive: doc.data().isActive,
});

const docToProblem = (doc: QueryDocumentSnapshot<DocumentData>): Problem => ({
  id: doc.id,
  themeId: doc.data().themeId, // Extract themeId
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

// Helper function to call the R2 delete API route
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
    console.error(`Error calling R2 delete API for key ${key}:`, error);
    throw error;
  }
};


// --- Theme CRUD Operations ---

export const getThemes = async (): Promise<Theme[]> => {
  const q = query(themesCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToTheme);
};

export const getTheme = async (id: string): Promise<Theme | null> => {
  const docRef = doc(db, "themes", id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToTheme(snapshot) : null;
};

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

export const updateTheme = async (
  id: string,
  themeData: Partial<Omit<Theme, "id" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", id);
  const existingTheme = await getTheme(id);

  // Compare media keys and delete old R2 objects if they are being replaced or removed
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

    const checkAndDelete = async (oldKey: string | null | undefined, newKey: string | null | undefined) => {
      if (typeof oldKey === 'string' && oldKey.length > 0 && oldKey !== newKey) {
        try {
          await callR2DeleteApi(oldKey);
        } catch (error) {
          console.warn(`Failed to delete old R2 object ${oldKey} during theme update:`, error);
        }
      }
    };

    // Iterate through all possible media keys for a theme
    for (let i = 0; i < oldKeys.length; i++) {
      await checkAndDelete(oldKeys[i], newKeys[i]);
    }
  }
  
  await updateDoc(docRef, {
    ...themeData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteTheme = async (id: string): Promise<void> => {
  const theme = await getTheme(id); // Fetch theme to get media keys

  if (theme) {
    // Before deleting the theme, delete all associated problems and their R2 objects
    const problems = await getProblemsByTheme(id);
    for (const problem of problems) {
      try {
        await deleteProblem(id, problem.id);
      } catch (error) {
        console.warn(`Failed to delete problem ${problem.id} for theme ${id} during theme deletion:`, error);
        // Continue with theme deletion even if problem deletion fails
      }
    }

    // Delete associated R2 objects for the theme itself
    const mediaKeys = [theme.thumbnailKey, theme.openingVideoKey, theme.openingBgmKey, theme.openingImageKey];
    for (const key of mediaKeys) {
      if (key) {
        try {
          await callR2DeleteApi(key);
        } catch (error) {
          console.warn(`Failed to delete R2 object ${key} for theme ${id}:`, error);
          // Continue with Firestore deletion even if R2 deletion fails for one item
        }
      }
    }
  }

  const docRef = doc(db, "themes", id);
  await deleteDoc(docRef);
};

// --- Problem CRUD Operations ---

// Helper to get problems collection for a specific theme
const getProblemsSubCollection = (themeId: string) =>
  collection(db, "themes", themeId, "problems");

export const getProblemsByTheme = async (themeId: string): Promise<Problem[]> => {
  const q = query(getProblemsSubCollection(themeId), orderBy("number", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToProblem);
};

export const getProblem = async (themeId: string, problemId: string): Promise<Problem | null> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? docToProblem(snapshot) : null;
};

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

export const updateProblem = async (
  themeId: string,
  problemId: string,
  problemData: Partial<Omit<Problem, "id" | "themeId" | "createdAt">>
): Promise<void> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  const existingProblem = await getProblem(themeId, problemId);

  // Compare media keys and delete old R2 objects if they are being replaced or removed
  if (existingProblem && existingProblem.media) {
    const oldMedia = existingProblem.media;
    const newMedia = problemData.media;

    // Helper to check and delete old key
    const checkAndDelete = async (oldKey: string | null | undefined, newKey: string | null | undefined) => {
      if (typeof oldKey === 'string' && oldKey.length > 0 && oldKey !== newKey) {
        try {
          await callR2DeleteApi(oldKey);
        } catch (error) {
          console.warn(`Failed to delete old R2 object ${oldKey} during problem update:`, error);
        }
      }
    };

    await checkAndDelete(oldMedia.imageKey, newMedia?.imageKey);
    await checkAndDelete(oldMedia.videoKey, newMedia?.videoKey);
    await checkAndDelete(oldMedia.bgmKey, newMedia?.bgmKey);
  }

  await updateDoc(docRef, {
    ...problemData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteProblem = async (themeId: string, problemId: string): Promise<void> => {
  const problem = await getProblem(themeId, problemId); // Fetch problem to get media keys

  if (problem && problem.media) {
    // Delete associated R2 objects
    const mediaKeys = [problem.media.imageKey, problem.media.videoKey, problem.media.bgmKey];
    for (const key of mediaKeys) {
      if (key) {
        try {
          await callR2DeleteApi(key);
        } catch (error) {
          console.warn(`Failed to delete R2 object ${key} for problem ${problemId}:`, error);
          // Continue with Firestore deletion even if R2 deletion fails for one item
        }
      }
    }
  }

  const docRef = doc(db, "themes", themeId, "problems", problemId);
  await deleteDoc(docRef);
};

export const getProblemCountByTheme = async (themeId: string): Promise<number> => {
  const q = query(getProblemsSubCollection(themeId));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

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
