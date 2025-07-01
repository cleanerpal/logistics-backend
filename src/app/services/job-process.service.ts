// src/app/services/job-process.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Firestore, doc, getDoc, collection, query, where, getDocs, orderBy } from '@angular/fire/firestore';

export interface JobProcessStepData {
  mileage?: number;
  fuelLevel?: number;
  energyType?: string;
  notes?: string;
  damageReportedThisStep?: boolean;
  contactName?: string;
  contactPosition?: string;
  contactNumber?: string;
  contactEmail?: string;
  signatureUrl?: string;
  photoUrls?: string[];
  checklistItems?: SavedChecklistItem[];
  createdAt?: any;
  updatedAt?: any;
}

export interface SavedChecklistItem {
  id: string;
  name: string;
  category: string;
  isChecked: boolean;
  notes?: string;
}

export interface ProcessDocuments {
  photos: ProcessPhoto[];
  signature?: ProcessSignature;
}

export interface ProcessPhoto {
  id: string;
  url: string;
  fileName: string;
  uploadedAt: any;
  type: 'collection' | 'delivery';
  description?: string;
}

export interface ProcessSignature {
  id: string;
  url: string;
  signerName: string;
  signerPosition?: string;
  uploadedAt: any;
  type: 'collection' | 'delivery';
}

export interface JobProcessData {
  collection?: JobProcessStepData;
  delivery?: JobProcessStepData;
  secondaryCollection?: JobProcessStepData;
  firstDelivery?: JobProcessStepData;
  documents: {
    collectionPhotos: ProcessPhoto[];
    deliveryPhotos: ProcessPhoto[];
    collectionSignature?: ProcessSignature;
    deliverySignature?: ProcessSignature;
    secondaryCollectionPhotos?: ProcessPhoto[];
    firstDeliveryPhotos?: ProcessPhoto[];
    secondaryCollectionSignature?: ProcessSignature;
    firstDeliverySignature?: ProcessSignature;
  };
}

@Injectable({
  providedIn: 'root',
})
export class JobProcessService {
  constructor(private firestore: Firestore) {}

  /**
   * Get complete job process data including all steps and documents
   */
  getJobProcessData(jobId: string): Observable<JobProcessData> {
    if (!jobId) {
      return of(this.createEmptyProcessData());
    }

    return this.getJobDocument(jobId).pipe(
      map((job) => this.extractProcessDataFromJob(job)),
      catchError((error) => {
        console.error('Error fetching job process data:', error);
        return of(this.createEmptyProcessData());
      })
    );
  }

  /**
   * Get collection process data
   */
  getCollectionData(jobId: string): Observable<JobProcessStepData | null> {
    return this.getJobDocument(jobId).pipe(
      map((job) => job?.collectionData || null),
      catchError(() => of(null))
    );
  }

  /**
   * Get delivery process data
   */
  getDeliveryData(jobId: string): Observable<JobProcessStepData | null> {
    return this.getJobDocument(jobId).pipe(
      map((job) => job?.deliveryData || null),
      catchError(() => of(null))
    );
  }

  /**
   * Get all process photos for a job
   */
  getProcessPhotos(jobId: string): Observable<ProcessPhoto[]> {
    return this.getJobDocument(jobId).pipe(
      map((job) => this.extractPhotosFromJob(job, jobId)),
      catchError(() => of([]))
    );
  }

  /**
   * Get all process signatures for a job
   */
  getProcessSignatures(jobId: string): Observable<ProcessSignature[]> {
    return this.getJobDocument(jobId).pipe(
      map((job) => this.extractSignaturesFromJob(job, jobId)),
      catchError(() => of([]))
    );
  }

  /**
   * Get damage reports for a job
   */
  getDamageReports(jobId: string): Observable<{ collection: boolean; delivery: boolean; overall: boolean }> {
    return this.getJobDocument(jobId).pipe(
      map((job) => ({
        collection: job?.collectionData?.damageReportedThisStep || false,
        delivery: job?.deliveryData?.damageReportedThisStep || false,
        overall: job?.hasDamageCommitted || false,
      })),
      catchError(() => of({ collection: false, delivery: false, overall: false }))
    );
  }

  /**
   * Get vehicle condition data
   */
  getVehicleConditionData(jobId: string): Observable<{
    collection: { mileage?: number; fuelLevel?: number; energyType?: string };
    delivery: { mileage?: number; fuelLevel?: number; energyType?: string };
  }> {
    return this.getJobDocument(jobId).pipe(
      map((job) => ({
        collection: {
          mileage: job?.collectionData?.mileage,
          fuelLevel: job?.collectionData?.fuelLevel,
          energyType: job?.collectionData?.energyType,
        },
        delivery: {
          mileage: job?.deliveryData?.mileage,
          fuelLevel: job?.deliveryData?.fuelLevel,
          energyType: job?.deliveryData?.energyType,
        },
      })),
      catchError(() =>
        of({
          collection: {},
          delivery: {},
        })
      )
    );
  }

  /**
   * Get contact information from processes
   */
  getProcessContacts(jobId: string): Observable<{
    collection?: { name: string; position?: string; phone?: string; email?: string };
    delivery?: { name: string; position?: string; phone?: string; email?: string };
  }> {
    return this.getJobDocument(jobId).pipe(
      map((job) => {
        const result: any = {};

        if (job?.collectionData?.contactName) {
          result.collection = {
            name: job.collectionData.contactName,
            position: job.collectionData.contactPosition,
            phone: job.collectionData.contactNumber,
            email: job.collectionData.contactEmail,
          };
        }

        if (job?.deliveryData?.contactName) {
          result.delivery = {
            name: job.deliveryData.contactName,
            position: job.deliveryData.contactPosition,
            phone: job.deliveryData.contactNumber,
            email: job.deliveryData.contactEmail,
          };
        }

        return result;
      }),
      catchError(() => of({}))
    );
  }

  // Private helper methods

  private getJobDocument(jobId: string): Observable<any> {
    const jobRef = doc(this.firestore, `jobs/${jobId}`);
    return new Observable((observer) => {
      getDoc(jobRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            observer.next({ id: docSnap.id, ...docSnap.data() });
          } else {
            observer.next(null);
          }
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

  private extractProcessDataFromJob(job: any): JobProcessData {
    if (!job) {
      return this.createEmptyProcessData();
    }

    return {
      collection: job.collectionData,
      delivery: job.deliveryData,
      secondaryCollection: job.secondaryCollectionData,
      firstDelivery: job.firstDeliveryData,
      documents: {
        collectionPhotos: this.extractPhotosFromProcessData(job.collectionData, 'collection', job.id),
        deliveryPhotos: this.extractPhotosFromProcessData(job.deliveryData, 'delivery', job.id),
        collectionSignature: this.extractSignatureFromProcessData(job.collectionData, 'collection', job.id),
        deliverySignature: this.extractSignatureFromProcessData(job.deliveryData, 'delivery', job.id),
        secondaryCollectionPhotos: this.extractPhotosFromProcessData(job.secondaryCollectionData, 'collection', job.id),
        firstDeliveryPhotos: this.extractPhotosFromProcessData(job.firstDeliveryData, 'delivery', job.id),
        secondaryCollectionSignature: this.extractSignatureFromProcessData(job.secondaryCollectionData, 'collection', job.id),
        firstDeliverySignature: this.extractSignatureFromProcessData(job.firstDeliveryData, 'delivery', job.id),
      },
    };
  }

  private extractPhotosFromJob(job: any, jobId: string): ProcessPhoto[] {
    if (!job) return [];

    const photos: ProcessPhoto[] = [];

    // Collection photos
    if (job.collectionData?.photoUrls) {
      photos.push(...this.extractPhotosFromProcessData(job.collectionData, 'collection', jobId));
    }

    // Delivery photos
    if (job.deliveryData?.photoUrls) {
      photos.push(...this.extractPhotosFromProcessData(job.deliveryData, 'delivery', jobId));
    }

    // Secondary collection photos
    if (job.secondaryCollectionData?.photoUrls) {
      photos.push(...this.extractPhotosFromProcessData(job.secondaryCollectionData, 'collection', jobId));
    }

    // First delivery photos
    if (job.firstDeliveryData?.photoUrls) {
      photos.push(...this.extractPhotosFromProcessData(job.firstDeliveryData, 'delivery', jobId));
    }

    return photos;
  }

  private extractSignaturesFromJob(job: any, jobId: string): ProcessSignature[] {
    if (!job) return [];

    const signatures: ProcessSignature[] = [];

    // Collection signature
    const collectionSig = this.extractSignatureFromProcessData(job.collectionData, 'collection', jobId);
    if (collectionSig) signatures.push(collectionSig);

    // Delivery signature
    const deliverySig = this.extractSignatureFromProcessData(job.deliveryData, 'delivery', jobId);
    if (deliverySig) signatures.push(deliverySig);

    // Secondary collection signature
    const secondaryCollectionSig = this.extractSignatureFromProcessData(job.secondaryCollectionData, 'collection', jobId);
    if (secondaryCollectionSig) signatures.push(secondaryCollectionSig);

    // First delivery signature
    const firstDeliverySig = this.extractSignatureFromProcessData(job.firstDeliveryData, 'delivery', jobId);
    if (firstDeliverySig) signatures.push(firstDeliverySig);

    return signatures;
  }

  private extractPhotosFromProcessData(processData: any, type: 'collection' | 'delivery', jobId: string): ProcessPhoto[] {
    if (!processData?.photoUrls || !Array.isArray(processData.photoUrls)) {
      return [];
    }

    return processData.photoUrls.map((url: string, index: number) => ({
      id: `${jobId}_${type}_photo_${index}`,
      url,
      fileName: this.getPhotoFileName(url, type, index),
      uploadedAt: processData.createdAt || processData.updatedAt || new Date(),
      type,
      description: this.getPhotoDescription(type, index),
    }));
  }

  private extractSignatureFromProcessData(processData: any, type: 'collection' | 'delivery', jobId: string): ProcessSignature | undefined {
    if (!processData?.signatureUrl) {
      return undefined;
    }

    return {
      id: `${jobId}_${type}_signature`,
      url: processData.signatureUrl,
      signerName: processData.contactName || 'Unknown',
      signerPosition: processData.contactPosition,
      uploadedAt: processData.createdAt || processData.updatedAt || new Date(),
      type,
    };
  }

  private getPhotoFileName(url: string, type: string, index: number): string {
    // Try to extract filename from URL
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];

    if (fileName && fileName.includes('.')) {
      return fileName.split('?')[0]; // Remove query parameters
    }

    // Fallback to descriptive name
    const photoTypes = ['front', 'rear', 'left', 'right'];
    const photoType = photoTypes[index] || `photo_${index + 1}`;
    return `${type}_${photoType}.jpg`;
  }

  private getPhotoDescription(type: 'collection' | 'delivery', index: number): string {
    const photoTypes = ['Front View', 'Rear View', 'Left Side', 'Right Side'];
    const photoType = photoTypes[index] || `Photo ${index + 1}`;
    const processType = type === 'collection' ? 'Collection' : 'Delivery';
    return `${processType} - ${photoType}`;
  }

  private createEmptyProcessData(): JobProcessData {
    return {
      documents: {
        collectionPhotos: [],
        deliveryPhotos: [],
        secondaryCollectionPhotos: [],
        firstDeliveryPhotos: [],
      },
    };
  }
}
