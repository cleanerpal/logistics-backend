import { Injectable } from '@angular/core';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
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

import { EnvironmentInjector, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private injector = inject(EnvironmentInjector);
  constructor(private storage: Storage) {}

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

    return from(this.injector.runInContext(() => uploadBytes(storageRef, file, uploadMetadata))).pipe(
      switchMap((snapshot) =>
        from(this.injector.runInContext(() => getDownloadURL(snapshot.ref))).pipe(
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

  uploadSignature(path: string, base64Data: string, metadata?: any): Observable<string> {
    if (!base64Data) {
      return throwError(() => new Error('No signature data provided'));
    }

    const storageRef = ref(this.storage, path);

    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const uploadMetadata = {
      contentType: 'image/png',
      customMetadata: {
        type: 'signature',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    };

    return from(this.injector.runInContext(() => uploadString(storageRef, cleanBase64, 'base64', uploadMetadata))).pipe(
      switchMap((snapshot) => from(this.injector.runInContext(() => getDownloadURL(snapshot.ref)))),
      catchError((error) => {
        console.error('Signature upload failed:', error);
        return throwError(() => new Error(`Signature upload failed: ${error.message}`));
      })
    );
  }

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

    return from(this.injector.runInContext(() => uploadBytes(storageRef, blob, uploadMetadata))).pipe(
      switchMap((snapshot) =>
        from(this.injector.runInContext(() => getDownloadURL(snapshot.ref))).pipe(
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

  getDownloadUrl(path: string): Observable<string> {
    const storageRef = ref(this.storage, path);
    return from(this.injector.runInContext(() => getDownloadURL(storageRef))).pipe(
      catchError((error) => {
        console.error('Failed to get download URL:', error);
        return throwError(() => new Error(`Failed to get download URL: ${error.message}`));
      })
    );
  }

  deleteFile(path: string): Observable<void> {
    const storageRef = ref(this.storage, path);
    return from(this.injector.runInContext(() => deleteObject(storageRef))).pipe(
      catchError((error) => {
        console.error('Delete failed:', error);
        return throwError(() => new Error(`Delete failed: ${error.message}`));
      })
    );
  }

  getFileMetadata(path: string): Observable<FileMetadata> {
    const storageRef = ref(this.storage, path);
    return from(this.injector.runInContext(() => getMetadata(storageRef))).pipe(
      switchMap((metadata) =>
        from(this.injector.runInContext(() => getDownloadURL(storageRef))).pipe(
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

  listFiles(path: string): Observable<FileMetadata[]> {
    const storageRef = ref(this.storage, path);

    return from(this.injector.runInContext(() => listAll(storageRef))).pipe(
      switchMap((result) => {
        const fileObservables = result.items.map((itemRef) => {
          const filePath = itemRef.fullPath;

          return from(this.injector.runInContext(() => getMetadata(itemRef))).pipe(
            switchMap((metadata) =>
              from(this.injector.runInContext(() => getDownloadURL(itemRef))).pipe(
                map((downloadUrl) => ({
                  name: metadata.name,
                  fullPath: metadata.fullPath,
                  size: metadata.size,
                  contentType: metadata.contentType || 'unknown',
                  timeCreated: metadata.timeCreated,
                  updated: metadata.updated,
                  downloadUrl,
                })),
                catchError((downloadError) => {
                  console.warn(`[StorageService] Using fallback metadata for ${filePath}:`, downloadError);
                  return of({
                    name: metadata.name,
                    fullPath: metadata.fullPath,
                    size: metadata.size,
                    contentType: metadata.contentType || 'unknown',
                    timeCreated: metadata.timeCreated,
                    updated: metadata.updated,
                  });
                })
              )
            ),
            catchError((metadataError) => {
              console.warn(`[StorageService] Skipping file due to metadata error for ${filePath}:`, metadataError);
              return of(null);
            })
          );
        });

        return forkJoin(fileObservables).pipe(map((files) => files.filter((file): file is FileMetadata => file !== null)));
      }),
      catchError((error) => {
        console.error('[StorageService] Failed to list files:', error);
        return throwError(() => new Error(`Failed to list files: ${error.message}`));
      })
    );
  }

  updateFileMetadata(path: string, metadata: any): Observable<any> {
    const storageRef = ref(this.storage, path);
    return from(this.injector.runInContext(() => updateMetadata(storageRef, metadata))).pipe(
      catchError((error) => {
        console.error('Failed to update metadata:', error);
        return throwError(() => new Error(`Failed to update metadata: ${error.message}`));
      })
    );
  }

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

  generateUniqueFileName(originalName: string, prefix?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(`.${extension}`, '');

    return prefix ? `${prefix}_${baseName}_${timestamp}.${extension}` : `${baseName}_${timestamp}.${extension}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isValidFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });
  }

  isValidFileSize(file: File, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }
}
