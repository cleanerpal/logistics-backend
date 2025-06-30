import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, orderBy, deleteDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  constructor(private firestore: Firestore) {}

  getCollection<T>(collectionName: string): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    return from(getDocs(collectionRef)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return { id: doc.id, ...doc.data() } as unknown as T;
        });
      }),
      catchError((error) => {
        console.error(`Error fetching collection ${collectionName}:`, error);
        return of([] as T[]);
      })
    );
  }

  getDocument<T>(collectionName: string, documentId: string): Observable<T | null> {
    const docRef = doc(this.firestore, `${collectionName}/${documentId}`);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as unknown as T;
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error(`Error fetching document ${documentId} from ${collectionName}:`, error);
        return of(null);
      })
    );
  }

  addDocument<T>(collectionName: string, data: any): Observable<string> {
    const collectionRef = collection(this.firestore, collectionName);
    return from(addDoc(collectionRef, data)).pipe(
      map((docRef) => docRef.id),
      catchError((error) => {
        console.error(`Error adding document to ${collectionName}:`, error);
        throw error;
      })
    );
  }

  updateDocument(collectionName: string, documentId: string, data: any): Observable<void> {
    const docRef = doc(this.firestore, `${collectionName}/${documentId}`);
    return from(updateDoc(docRef, data)).pipe(
      catchError((error) => {
        console.error(`Error updating document ${documentId} in ${collectionName}:`, error);
        throw error;
      })
    );
  }

  queryCollection<T>(
    collectionName: string,
    fieldPath: string,
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=',
    value: any,
    orderByField?: string,
    orderDirection?: 'asc' | 'desc'
  ): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);

    let q = query(collectionRef, where(fieldPath, operator, value));

    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection || 'asc'));
    }

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return { id: doc.id, ...doc.data() } as unknown as T;
        });
      }),
      catchError((error) => {
        console.error(`Error querying collection ${collectionName}:`, error);
        return of([] as T[]);
      })
    );
  }

  deleteDocument(collectionName: string, documentId: string): Observable<void> {
    const docRef = doc(this.firestore, `${collectionName}/${documentId}`);

    return from(deleteDoc(docRef)).pipe(
      catchError((error) => {
        console.error(`Error deleting document ${documentId} from ${collectionName}:`, error);
        throw error;
      })
    );
  }
}
