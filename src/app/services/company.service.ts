import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, switchMap } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  Timestamp,
  CollectionReference,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: 'active' | 'inactive';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private companiesSubject = new BehaviorSubject<Company[]>([]);
  public companies$ = this.companiesSubject.asObservable();

  private companiesCollection: CollectionReference;
  private isLoading = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoading.asObservable();

  constructor(private firestore: Firestore, private snackBar: MatSnackBar) {
    this.companiesCollection = collection(this.firestore, 'companies');
  }

  /**
   * Get a list of all companies
   */
  getAllCompanies(): Observable<Company[]> {
    this.isLoading.next(true);

    const companiesQuery = query(
      this.companiesCollection,
      orderBy('name', 'asc')
    );

    return from(getDocs(companiesQuery)).pipe(
      map((querySnapshot) => {
        const companies = querySnapshot.docs.map((doc) => {
          return { id: doc.id, ...doc.data() } as Company;
        });
        this.companiesSubject.next(companies);
        return companies;
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error fetching companies:', error);
        this.isLoading.next(false);
        this.showSnackBar('Failed to load companies', 'error');
        // Return empty array to avoid breaking the UI
        return from([[] as Company[]]);
      })
    );
  }

  /**
   * Get a specific company by ID
   */
  getCompanyById(companyId: string): Observable<Company> {
    this.isLoading.next(true);

    const companyRef = doc(this.firestore, 'companies', companyId);

    return from(getDoc(companyRef)).pipe(
      map((companyDoc) => {
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }
        return { id: companyDoc.id, ...companyDoc.data() } as Company;
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error fetching company:', error);
        this.isLoading.next(false);
        this.showSnackBar('Failed to load company', 'error');
        throw error;
      })
    );
  }

  /**
   * Create a new company
   */
  createCompany(companyData: Partial<Company>): Observable<Company> {
    this.isLoading.next(true);

    // Generate a document ID or use the provided one
    const companyId = doc(collection(this.firestore, 'companies')).id;

    // Prepare company data
    const newCompany: Partial<Company> = {
      ...companyData,
      id: companyId,
      status: companyData.status || 'active',
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    // Store in Firestore
    const companyRef = doc(this.firestore, 'companies', companyId);

    return from(
      setDoc(companyRef, {
        ...newCompany,
        id: undefined, // Remove ID as it's part of the document path
      })
    ).pipe(
      map(() => {
        const createdCompany = { id: companyId, ...newCompany } as Company;
        // Refresh the companies list
        this.getAllCompanies().subscribe();
        this.showSnackBar('Company created successfully', 'success');
        return createdCompany;
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error creating company:', error);
        this.isLoading.next(false);
        this.showSnackBar(
          `Failed to create company: ${error.message}`,
          'error'
        );
        throw error;
      })
    );
  }

  /**
   * Update an existing company
   */
  updateCompany(
    companyId: string,
    companyData: Partial<Company>
  ): Observable<Company> {
    this.isLoading.next(true);

    const companyRef = doc(this.firestore, 'companies', companyId);

    return from(getDoc(companyRef)).pipe(
      switchMap((companyDoc) => {
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }
        const updatedData = {
          ...companyData,
          updatedAt: serverTimestamp(),
        };

        return from(updateDoc(companyRef, updatedData)).pipe(
          map(() => {
            const updatedCompany = {
              id: companyId,
              ...companyDoc.data(),
              ...companyData,
            } as Company;
            // Refresh the list
            this.getAllCompanies().subscribe();
            this.showSnackBar('Company updated successfully', 'success');
            return updatedCompany;
          })
        );
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error updating company:', error);
        this.isLoading.next(false);
        this.showSnackBar(
          `Failed to update company: ${error.message}`,
          'error'
        );
        throw error;
      })
    );
  }

  /**
   * Delete a company
   */
  deleteCompany(companyId: string): Observable<void> {
    this.isLoading.next(true);

    const companyRef = doc(this.firestore, 'companies', companyId);

    return from(getDoc(companyRef)).pipe(
      switchMap((companyDoc) => {
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }
        return from(deleteDoc(companyRef)).pipe(
          map(() => {
            // Refresh the list
            this.getAllCompanies().subscribe();
            this.showSnackBar('Company deleted successfully', 'success');
          })
        );
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error deleting company:', error);
        this.isLoading.next(false);
        this.showSnackBar(
          `Failed to delete company: ${error.message}`,
          'error'
        );
        throw error;
      })
    );
  }

  /**
   * Show snackbar message
   */
  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    const className = {
      success: 'success-snackbar',
      error: 'error-snackbar',
      info: 'info-snackbar',
    }[type];

    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [className],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
