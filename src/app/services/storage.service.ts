// src/app/services/storage.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Storage, ref, uploadBytes, uploadString, getDownloadURL, deleteObject, getMetadata, updateMetadata, listAll, StorageReference } from '@angular/fire/storage';

export interface UploadResult {
  downloadUrl: string;
  fullPath: string;
  fileName: string;
  size: number;
  contentType: string;
  timeCreated: string;
}

export interface FileMetadata {
  name: string;
  fullPath: string;
  size: number;
  contentType: string;
  timeCreated: string;
  updated: string;
  downloadUrl?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  constructor(private storage: Storage) {}

  /**
   * Upload a file to Firebase Storage
   */
  uploadFile(path: string, file: File, metadata?: any): Observable<UploadResult> {
    if (!file) {
      return throwError(() => new Error('No file provided'));
    }

    const storageRef = ref(this.storage, path);

    const uploadMetadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    };

    return from(uploadBytes(storageRef, file, uploadMetadata)).pipe(
      switchMap((snapshot) =>
        from(getDownloadURL(snapshot.ref)).pipe(
          map((downloadUrl) => ({
            downloadUrl,
            fullPath: snapshot.ref.fullPath,
            fileName: file.name,
            size: snapshot.metadata.size || file.size,
            contentType: snapshot.metadata.contentType || file.type,
            timeCreated: snapshot.metadata.timeCreated || new Date().toISOString(),
          }))
        )
      ),
      catchError((error) => {
        console.error('Upload failed:', error);
        return throwError(() => new Error(`Upload failed: ${error.message}`));
      })
    );
  }

  /**
   * Upload a signature (base64 string) to Firebase Storage
   */
  uploadSignature(path: string, base64Data: string, metadata?: any): Observable<string> {
    if (!base64Data) {
      return throwError(() => new Error('No signature data provided'));
    }

    const storageRef = ref(this.storage, path);

    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const uploadMetadata = {
      contentType: 'image/png',
      customMetadata: {
        type: 'signature',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    };

    return from(uploadString(storageRef, cleanBase64, 'base64', uploadMetadata)).pipe(
      switchMap((snapshot) => from(getDownloadURL(snapshot.ref))),
      catchError((error) => {
        console.error('Signature upload failed:', error);
        return throwError(() => new Error(`Signature upload failed: ${error.message}`));
      })
    );
  }

  /**
   * Upload blob data (for PDFs, etc.)
   */
  uploadBlob(path: string, blob: Blob, contentType: string, metadata?: any): Observable<UploadResult> {
    if (!blob) {
      return throwError(() => new Error('No blob data provided'));
    }

    const storageRef = ref(this.storage, path);

    const uploadMetadata = {
      contentType,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    };

    return from(uploadBytes(storageRef, blob, uploadMetadata)).pipe(
      switchMap((snapshot) =>
        from(getDownloadURL(snapshot.ref)).pipe(
          map((downloadUrl) => ({
            downloadUrl,
            fullPath: snapshot.ref.fullPath,
            fileName: path.split('/').pop() || 'file',
            size: snapshot.metadata.size || blob.size,
            contentType: snapshot.metadata.contentType || contentType,
            timeCreated: snapshot.metadata.timeCreated || new Date().toISOString(),
          }))
        )
      ),
      catchError((error) => {
        console.error('Blob upload failed:', error);
        return throwError(() => new Error(`Blob upload failed: ${error.message}`));
      })
    );
  }

  /**
   * Get download URL for a file
   */
  getDownloadUrl(path: string): Observable<string> {
    const storageRef = ref(this.storage, path);
    return from(getDownloadURL(storageRef)).pipe(
      catchError((error) => {
        console.error('Failed to get download URL:', error);
        return throwError(() => new Error(`Failed to get download URL: ${error.message}`));
      })
    );
  }

  /**
   * Delete a file from storage
   */
  deleteFile(path: string): Observable<void> {
    const storageRef = ref(this.storage, path);
    return from(deleteObject(storageRef)).pipe(
      catchError((error) => {
        console.error('Delete failed:', error);
        return throwError(() => new Error(`Delete failed: ${error.message}`));
      })
    );
  }

  /**
   * Get file metadata
   */
  getFileMetadata(path: string): Observable<FileMetadata> {
    const storageRef = ref(this.storage, path);
    return from(getMetadata(storageRef)).pipe(
      switchMap((metadata) =>
        from(getDownloadURL(storageRef)).pipe(
          map((downloadUrl) => ({
            name: metadata.name,
            fullPath: metadata.fullPath,
            size: metadata.size,
            contentType: metadata.contentType || 'unknown',
            timeCreated: metadata.timeCreated,
            updated: metadata.updated,
            downloadUrl,
          })),
          catchError(() =>
            // If getting download URL fails, return metadata without it
            of({
              name: metadata.name,
              fullPath: metadata.fullPath,
              size: metadata.size,
              contentType: metadata.contentType || 'unknown',
              timeCreated: metadata.timeCreated,
              updated: metadata.updated,
            } as FileMetadata)
          )
        )
      ),
      catchError((error) => {
        console.error('Failed to get metadata:', error);
        return throwError(() => new Error(`Failed to get metadata: ${error.message}`));
      })
    );
  }

  /**
   * List all files in a directory
   */
  listFiles(path: string): Observable<FileMetadata[]> {
    const storageRef = ref(this.storage, path);
    return from(listAll(storageRef)).pipe(
      switchMap((result) => {
        const filePromises = result.items.map((item) =>
          from(getMetadata(item)).pipe(
            switchMap((metadata) =>
              from(getDownloadURL(item)).pipe(
                map(
                  (downloadUrl) =>
                    ({
                      name: metadata.name,
                      fullPath: metadata.fullPath,
                      size: metadata.size,
                      contentType: metadata.contentType || 'unknown',
                      timeCreated: metadata.timeCreated,
                      updated: metadata.updated,
                      downloadUrl,
                    } as FileMetadata)
                ),
                catchError(() =>
                  of({
                    name: metadata.name,
                    fullPath: metadata.fullPath,
                    size: metadata.size,
                    contentType: metadata.contentType || 'unknown',
                    timeCreated: metadata.timeCreated,
                    updated: metadata.updated,
                  } as FileMetadata)
                )
              )
            ),
            catchError((error) => {
              console.warn(`Failed to get metadata for ${item.fullPath}:`, error);
              return of(null);
            })
          )
        );

        return from(Promise.all(filePromises)).pipe(map((files) => files.filter((file) => file !== null) as unknown as FileMetadata[]));
      }),
      catchError((error) => {
        console.error('Failed to list files:', error);
        return throwError(() => new Error(`Failed to list files: ${error.message}`));
      })
    );
  }

  /**
   * Update file metadata
   */
  updateFileMetadata(path: string, metadata: any): Observable<any> {
    const storageRef = ref(this.storage, path);
    return from(updateMetadata(storageRef, metadata)).pipe(
      catchError((error) => {
        console.error('Failed to update metadata:', error);
        return throwError(() => new Error(`Failed to update metadata: ${error.message}`));
      })
    );
  }

  /**
   * Get all photos for a job
   */
  getJobPhotos(jobId: string): Observable<FileMetadata[]> {
    const photoPaths = [
      `jobs/${jobId}/collection_photos`,
      `jobs/${jobId}/delivery_photos`,
      `jobs/${jobId}/secondary_collection_photos`,
      `jobs/${jobId}/first_delivery_photos`,
    ];

    const photoObservables = photoPaths.map((path) => this.listFiles(path).pipe(catchError(() => of([] as FileMetadata[]))));

    return forkJoin(photoObservables).pipe(
      map((results) => results.flat()),
      catchError(() => of([] as FileMetadata[]))
    );
  }

  /**
   * Get all signatures for a job
   */
  getJobSignatures(jobId: string): Observable<FileMetadata[]> {
    const signaturePaths = [
      `jobs/${jobId}/collection_signatures`,
      `jobs/${jobId}/delivery_signatures`,
      `jobs/${jobId}/secondary_collection_signatures`,
      `jobs/${jobId}/first_delivery_signatures`,
    ];

    const signatureObservables = signaturePaths.map((path) => this.listFiles(path).pipe(catchError(() => of([] as FileMetadata[]))));

    return forkJoin(signatureObservables).pipe(
      map((results) => results.flat()),
      catchError(() => of([] as FileMetadata[]))
    );
  }

  /**
   * Get all documents for a job (photos + signatures + reports)
   */
  getAllJobDocuments(jobId: string): Observable<{
    photos: FileMetadata[];
    signatures: FileMetadata[];
    reports: FileMetadata[];
  }> {
    return forkJoin({
      photos: this.getJobPhotos(jobId),
      signatures: this.getJobSignatures(jobId),
      reports: this.listFiles(`jobs/${jobId}/reports`).pipe(catchError(() => of([] as FileMetadata[]))),
    }).pipe(
      catchError(() =>
        of({
          photos: [] as FileMetadata[],
          signatures: [] as FileMetadata[],
          reports: [] as FileMetadata[],
        })
      )
    );
  }

  /**
   * Delete all job documents
   */
  deleteJobDocuments(jobId: string): Observable<void> {
    const basePath = `jobs/${jobId}`;
    return this.listFiles(basePath).pipe(
      switchMap((files) => {
        if (files.length === 0) {
          return of(void 0);
        }

        const deleteObservables = files.map((file) =>
          this.deleteFile(file.fullPath).pipe(
            catchError((error) => {
              console.warn(`Failed to delete ${file.fullPath}:`, error);
              return of(void 0);
            })
          )
        );

        return forkJoin(deleteObservables).pipe(map(() => void 0));
      }),
      catchError((error) => {
        console.error('Failed to delete job documents:', error);
        return throwError(() => new Error(`Failed to delete job documents: ${error.message}`));
      })
    );
  }

  /**
   * Generate a unique filename with timestamp
   */
  generateUniqueFileName(originalName: string, prefix?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(`.${extension}`, '');

    return prefix ? `${prefix}_${baseName}_${timestamp}.${extension}` : `${baseName}_${timestamp}.${extension}`;
  }

  /**
   * Get file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate file type
   */
  isValidFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });
  }

  /**
   * Validate file size
   */
  isValidFileSize(file: File, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
}
