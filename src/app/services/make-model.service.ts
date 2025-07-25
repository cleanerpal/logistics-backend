import { Injectable, NgZone } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  DocumentData,
  Firestore,
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Timestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, combineLatest, from, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import {
  BulkMakeModelOperation,
  CreateMakeModelRequest,
  Make,
  MakeModelQueryOptions,
  MakeModelSearchResult,
  Model,
  UpdateMakeModelRequest,
} from '../interfaces/make-model.interface';
import { AuthService } from './auth.service';
@Injectable({
  providedIn: 'root',
})
export class MakeModelService {
  private readonly MAKES_COLLECTION = 'vehicleMakes';
  private readonly MODELS_COLLECTION = 'vehicleModels';

  private makesSubject = new BehaviorSubject<Make[]>([]);
  private modelsSubject = new BehaviorSubject<Model[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public makes$ = this.makesSubject.asObservable();
  public models$ = this.modelsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  private activeListeners: Unsubscribe[] = [];

  private makesCache = new Map<string, Make>();
  private modelsCache = new Map<string, Model>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(private firestore: Firestore, private auth: Auth, private authService: AuthService, private ngZone: NgZone) {
    this.initializeRealtimeListeners();
  }

  ngOnDestroy(): void {
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    this.activeListeners.forEach((unsubscribe) => unsubscribe());
    this.activeListeners = [];
  }

  private initializeRealtimeListeners(): void {
    const makesQuery = query(collection(this.firestore, this.MAKES_COLLECTION), where('isActive', '==', true), orderBy('name', 'asc'));

    const makesUnsubscribe = onSnapshot(
      makesQuery,
      (snapshot) => {
        this.ngZone.run(() => {
          const makes = snapshot.docs.map((doc) => this.convertToMake(doc.id, doc.data()));
          this.makesSubject.next(makes);

          makes.forEach((make) => this.makesCache.set(make.id, make));
          this.lastCacheUpdate = Date.now();
        });
      },
      (error) => {
        console.error('Error in makes listener:', error);
      }
    );

    const modelsQuery = query(collection(this.firestore, this.MODELS_COLLECTION), where('isActive', '==', true), orderBy('name', 'asc'));

    const modelsUnsubscribe = onSnapshot(
      modelsQuery,
      (snapshot) => {
        this.ngZone.run(() => {
          const models = snapshot.docs.map((doc) => this.convertToModel(doc.id, doc.data()));
          this.modelsSubject.next(models);

          models.forEach((model) => this.modelsCache.set(model.id, model));
          this.lastCacheUpdate = Date.now();
        });
      },
      (error) => {
        console.error('Error in models listener:', error);
      }
    );

    this.activeListeners.push(makesUnsubscribe, modelsUnsubscribe);
  }

  getAllMakes(options?: MakeModelQueryOptions): Observable<Make[]> {
    if (this.isCacheValid() && !options) {
      return this.makes$;
    }

    this.loadingSubject.next(true);

    let makesQuery = query(collection(this.firestore, this.MAKES_COLLECTION));

    if (options?.vehicleType) {
      makesQuery = query(makesQuery, where('vehicleTypes', 'array-contains', options.vehicleType));
    }

    if (!options?.includeInactive) {
      makesQuery = query(makesQuery, where('isActive', '==', true));
    }

    const orderField = options?.orderBy || 'name';
    const orderDir = options?.orderDirection || 'asc';
    makesQuery = query(makesQuery, orderBy(orderField, orderDir));

    if (options?.limit) {
      makesQuery = query(makesQuery, limit(options.limit));
    }

    return from(getDocs(makesQuery)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertToMake(doc.id, doc.data()))),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        this.loadingSubject.next(false);
        console.error('Error fetching makes:', error);
        return throwError(() => new Error('Failed to fetch vehicle makes'));
      }),
      shareReplay(1)
    );
  }

  getMakesByType(vehicleType: string): Observable<Make[]> {
    return this.getAllMakes({ vehicleType, isActive: true });
  }

  getAllModels(options?: MakeModelQueryOptions): Observable<Model[]> {
    if (this.isCacheValid() && !options) {
      return this.models$;
    }

    this.loadingSubject.next(true);

    let modelsQuery = query(collection(this.firestore, this.MODELS_COLLECTION));

    if (options?.makeId) {
      modelsQuery = query(modelsQuery, where('makeId', '==', options.makeId));
    }

    if (!options?.includeInactive) {
      modelsQuery = query(modelsQuery, where('isActive', '==', true));
    }

    const orderField = options?.orderBy || 'name';
    const orderDir = options?.orderDirection || 'asc';
    modelsQuery = query(modelsQuery, orderBy(orderField, orderDir));

    if (options?.limit) {
      modelsQuery = query(modelsQuery, limit(options.limit));
    }

    return from(getDocs(modelsQuery)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertToModel(doc.id, doc.data()))),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        this.loadingSubject.next(false);
        console.error('Error fetching models:', error);
        return throwError(() => new Error('Failed to fetch vehicle models'));
      }),
      shareReplay(1)
    );
  }

  getModelsByMake(makeId: string): Observable<Model[]> {
    return this.getAllModels({ makeId, isActive: true });
  }

  getMakeById(makeId: string): Observable<Make | null> {
    if (this.makesCache.has(makeId)) {
      return new BehaviorSubject(this.makesCache.get(makeId)!).asObservable();
    }

    const makeRef = doc(this.firestore, this.MAKES_COLLECTION, makeId);
    return from(getDoc(makeRef)).pipe(
      map((doc) => (doc.exists() ? this.convertToMake(doc.id, doc.data()) : null)),
      tap((make) => {
        if (make) {
          this.makesCache.set(make.id, make);
        }
      }),
      catchError((error) => {
        console.error('Error fetching make by ID:', error);
        return throwError(() => new Error('Failed to fetch make details'));
      })
    );
  }

  getModelById(modelId: string): Observable<Model | null> {
    if (this.modelsCache.has(modelId)) {
      return new BehaviorSubject(this.modelsCache.get(modelId)!).asObservable();
    }

    const modelRef = doc(this.firestore, this.MODELS_COLLECTION, modelId);
    return from(getDoc(modelRef)).pipe(
      map((doc) => (doc.exists() ? this.convertToModel(doc.id, doc.data()) : null)),
      tap((model) => {
        if (model) {
          this.modelsCache.set(model.id, model);
        }
      }),
      catchError((error) => {
        console.error('Error fetching model by ID:', error);
        return throwError(() => new Error('Failed to fetch model details'));
      })
    );
  }

  search(searchTerm: string, options?: MakeModelQueryOptions): Observable<MakeModelSearchResult> {
    const searchLower = searchTerm.toLowerCase();

    return combineLatest([this.getAllMakes(options), this.getAllModels(options)]).pipe(
      map(([makes, models]) => {
        const filteredMakes = makes.filter(
          (make) =>
            make.name.toLowerCase().includes(searchLower) ||
            make.displayName?.toLowerCase().includes(searchLower) ||
            make.aliases?.some((alias) => alias.toLowerCase().includes(searchLower))
        );

        const filteredModels = models.filter(
          (model) =>
            model.name.toLowerCase().includes(searchLower) ||
            model.displayName?.toLowerCase().includes(searchLower) ||
            model.aliases?.some((alias) => alias.toLowerCase().includes(searchLower))
        );

        return {
          makes: filteredMakes,
          models: filteredModels,
          total: filteredMakes.length + filteredModels.length,
        };
      })
    );
  }

  createMake(data: CreateMakeModelRequest): Observable<string> {
    return from(this.getCurrentUserId()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error('User must be authenticated to create makes');
        }

        const now = new Date();
        const makeData = {
          ...data,
          type: 'make',
          isActive: true,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now),
          createdBy: userId,
          popularity: 0,
        };

        const makesRef = collection(this.firestore, this.MAKES_COLLECTION);
        return from(addDoc(makesRef, makeData));
      }),
      map((docRef) => docRef.id),
      catchError((error) => {
        console.error('Error creating make:', error);
        return throwError(() => new Error('Failed to create vehicle make'));
      })
    );
  }

  createModel(data: CreateMakeModelRequest): Observable<string> {
    if (!data.makeId) {
      return throwError(() => new Error('Make ID is required for creating models'));
    }

    return from(this.getCurrentUserId()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error('User must be authenticated to create models');
        }

        const now = new Date();
        const modelData = {
          ...data,
          type: 'model',
          isActive: true,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now),
          createdBy: userId,
          popularity: 0,
        };

        const modelsRef = collection(this.firestore, this.MODELS_COLLECTION);
        return from(addDoc(modelsRef, modelData));
      }),
      map((docRef) => docRef.id),
      catchError((error) => {
        console.error('Error creating model:', error);
        return throwError(() => new Error('Failed to create vehicle model'));
      })
    );
  }

  updateMake(makeId: string, data: UpdateMakeModelRequest): Observable<void> {
    return from(this.getCurrentUserId()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error('User must be authenticated to update makes');
        }

        const updateData = {
          ...data,
          updatedAt: Timestamp.fromDate(new Date()),
          updatedBy: userId,
        };

        const makeRef = doc(this.firestore, this.MAKES_COLLECTION, makeId);
        return from(updateDoc(makeRef, updateData));
      }),
      tap(() => {
        this.makesCache.delete(makeId);
      }),
      catchError((error) => {
        console.error('Error updating make:', error);
        return throwError(() => new Error('Failed to update vehicle make'));
      })
    );
  }

  updateModel(modelId: string, data: UpdateMakeModelRequest): Observable<void> {
    return from(this.getCurrentUserId()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error('User must be authenticated to update models');
        }

        const updateData = {
          ...data,
          updatedAt: Timestamp.fromDate(new Date()),
          updatedBy: userId,
        };

        const modelRef = doc(this.firestore, this.MODELS_COLLECTION, modelId);
        return from(updateDoc(modelRef, updateData));
      }),
      tap(() => {
        this.modelsCache.delete(modelId);
      }),
      catchError((error) => {
        console.error('Error updating model:', error);
        return throwError(() => new Error('Failed to update vehicle model'));
      })
    );
  }

  deleteMake(makeId: string): Observable<void> {
    return this.updateMake(makeId, { isActive: false });
  }

  deleteModel(modelId: string): Observable<void> {
    return this.updateModel(modelId, { isActive: false });
  }

  hardDeleteMake(makeId: string): Observable<void> {
    const makeRef = doc(this.firestore, this.MAKES_COLLECTION, makeId);
    return from(deleteDoc(makeRef)).pipe(
      tap(() => {
        this.makesCache.delete(makeId);
      }),
      catchError((error) => {
        console.error('Error deleting make:', error);
        return throwError(() => new Error('Failed to delete vehicle make'));
      })
    );
  }

  hardDeleteModel(modelId: string): Observable<void> {
    const modelRef = doc(this.firestore, this.MODELS_COLLECTION, modelId);
    return from(deleteDoc(modelRef)).pipe(
      tap(() => {
        this.modelsCache.delete(modelId);
      }),
      catchError((error) => {
        console.error('Error deleting model:', error);
        return throwError(() => new Error('Failed to delete vehicle model'));
      })
    );
  }

  bulkOperation(operation: BulkMakeModelOperation): Observable<void> {
    return from(this.getCurrentUserId()).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error('User must be authenticated for bulk operations');
        }

        const batch = writeBatch(this.firestore);
        const now = new Date();

        operation.items.forEach((item) => {
          if (operation.action === 'create') {
            const createItem = item as CreateMakeModelRequest;
            const collection_name = createItem.makeId ? this.MODELS_COLLECTION : this.MAKES_COLLECTION;
            const docRef = doc(collection(this.firestore, collection_name));

            batch.set(docRef, {
              ...createItem,
              type: createItem.makeId ? 'model' : 'make',
              isActive: true,
              createdAt: Timestamp.fromDate(now),
              updatedAt: Timestamp.fromDate(now),
              createdBy: userId,
              popularity: 0,
            });
          } else if (operation.action === 'update') {
            const updateItem = item as UpdateMakeModelRequest & { id: string };

            const collection_name = 'makeId' in updateItem ? this.MODELS_COLLECTION : this.MAKES_COLLECTION;
            const docRef = doc(this.firestore, collection_name, updateItem.id);

            batch.update(docRef, {
              ...updateItem,
              updatedAt: Timestamp.fromDate(now),
              updatedBy: userId,
            });
          } else if (operation.action === 'delete') {
            const deleteItem = item as { id: string };
          }
        });

        return from(batch.commit());
      }),
      tap(() => {
        this.clearCache();
      }),
      catchError((error) => {
        console.error('Error in bulk operation:', error);
        return throwError(() => new Error('Failed to perform bulk operation'));
      })
    );
  }

  clearCache(): void {
    this.makesCache.clear();
    this.modelsCache.clear();
    this.lastCacheUpdate = 0;
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  private convertToMake(id: string, data: DocumentData): Make {
    return {
      id: data['id'] || id,
      docId: id,
      name: data['name'] || '',
      displayName: data['displayName'] || data['name'] || '',
      type: data['type'] || 'make',
      vehicleTypes: data['vehicleTypes'] || [],
      isActive: data['isActive'] ?? true,
      createdAt: data['createdAt'] || Timestamp.now(),
      updatedAt: data['updatedAt'] || Timestamp.now(),
      createdBy: data['createdBy'] || 'system',
      updatedBy: data['updatedBy'] || null,
      logoUrl: data['logoUrl'] || null,
      popularity: data['popularity'] || 0,
      aliases: data['aliases'] || [],
      icon: data['icon'] || null,
    } as Make;
  }

  private convertToModel(id: string, data: DocumentData): Model {
    return {
      id,
      name: data['name'] || '',
      displayName: data['displayName'] || data['name'] || '',
      type: 'model',
      makeId: data['makeId'] || '',
      makeName: data['makeName'] || null,
      isActive: data['isActive'] ?? true,
      createdAt: data['createdAt'] || Timestamp.now(),
      updatedAt: data['updatedAt'] || Timestamp.now(),
      createdBy: data['createdBy'] || 'system',
      updatedBy: data['updatedBy'] || null,
      popularity: data['popularity'] || 0,
      aliases: data['aliases'] || [],
    };
  }

  private async getCurrentUserId(): Promise<string | null> {
    return new Promise((resolve) => {
      this.authService.getCurrentUser().subscribe((user) => {
        resolve(user?.id || null);
      });
    });
  }
}
