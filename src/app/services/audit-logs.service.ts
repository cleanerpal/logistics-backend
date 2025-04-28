import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
  QueryConstraint,
} from '@angular/fire/firestore';
import { AuditLog } from '../pages/audit-logs/audit-logs-list/audit-logs-list.component';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root',
})
export class AuditLogsService {
  private firebaseService = inject(FirebaseService);
  private firestore: Firestore = inject(Firestore);

  // Get all audit logs with optional query constraints
  getAuditLogs(queryConstraints?: QueryConstraint[]): Observable<AuditLog[]> {
    return this.firebaseService
      .getCollectionWithSnapshot<AuditLog>('auditLogs', queryConstraints)
      .pipe(
        map((logs) =>
          logs.map((log) => ({
            ...log,
            timestamp:
              log.timestamp instanceof Date
                ? log.timestamp
                : new Date(
                    (log.timestamp as { seconds: number }).seconds * 1000
                  ),
          }))
        )
      );
  }

  // Get a single audit log by ID
  getAuditLogById(id: string): Observable<AuditLog | null> {
    return this.firebaseService
      .getDocumentWithSnapshot<AuditLog>('auditLogs', id)
      .pipe(
        map((log) => {
          if (!log) return null;

          return {
            ...log,
            timestamp:
              log.timestamp instanceof Date
                ? log.timestamp
                : new Date(
                    (log.timestamp as { seconds: number }).seconds * 1000
                  ),
          };
        })
      );
  }

  // Create an audit log entry
  async createAuditLog(
    data: Omit<AuditLog, 'id' | 'timestamp'>
  ): Promise<string> {
    try {
      const user = await firstValueFrom(
        this.firebaseService.user$.pipe(
          map((user) =>
            user
              ? {
                  userId: user.uid,
                  userName: user.displayName || user.email,
                }
              : {
                  userId: 'unknown',
                  userName: 'Unknown User',
                }
          )
        )
      );

      const auditLogData = {
        ...data,
        ...user,
        timestamp: serverTimestamp(),
      };

      const collectionRef = collection(this.firestore, 'auditLogs');
      const docRef = await addDoc(collectionRef, auditLogData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }
}
