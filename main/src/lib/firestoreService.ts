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
  await updateDoc(docRef, {
    ...themeData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteTheme = async (id: string): Promise<void> => {
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
  await updateDoc(docRef, {
    ...problemData,
    updatedAt: Timestamp.now(),
  });
};

export const deleteProblem = async (themeId: string, problemId: string): Promise<void> => {
  const docRef = doc(db, "themes", themeId, "problems", problemId);
  await deleteDoc(docRef);
};

export const getProblemCountByTheme = async (themeId: string): Promise<number> => {
  const q = query(getProblemsSubCollection(themeId));
  const snapshot = await getDocs(q);
  return snapshot.size;
};
