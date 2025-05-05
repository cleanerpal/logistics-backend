import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Customer {
  id: string;
  name: string;
  address?: string;
  category?: string;
  city?: string;
  contactName?: string;
  contactPhone?: string;
  contactPosition?: string;
  country?: string;
  email?: string;
  isActive: boolean;
  postcode?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  constructor(private firestore: Firestore) {}

  /**
   * Get all active customers
   */
  getCustomers(): Observable<Customer[]> {
    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return this.convertFirebaseCustomerToModel(doc.id, doc.data());
        });
      }),
      catchError((error) => {
        console.error('Error fetching customers:', error);
        return of([]);
      })
    );
  }

  /**
   * Get a customer by ID
   */
  getCustomerById(id: string): Observable<Customer | null> {
    if (!id) {
      return of(null);
    }

    const customerRef = doc(this.firestore, `customers/${id}`);

    return from(getDoc(customerRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseCustomerToModel(
            docSnap.id,
            docSnap.data()
          );
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error(`Error fetching customer ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get customers by category
   */
  getCustomersByCategory(category: string): Observable<Customer[]> {
    if (!category) {
      return of([]);
    }

    const customersRef = collection(this.firestore, 'customers');
    const q = query(
      customersRef,
      where('category', '==', category),
      where('isActive', '==', true)
    );

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return this.convertFirebaseCustomerToModel(doc.id, doc.data());
        });
      }),
      catchError((error) => {
        console.error(
          `Error fetching customers of category ${category}:`,
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Search customers by name or contact name
   */
  searchCustomers(searchTerm: string): Observable<Customer[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return of([]);
    }

    // Firebase doesn't support native text search, so we'll fetch all customers
    // and filter them client-side
    return this.getCustomers().pipe(
      map((customers) => {
        const normalizedSearchTerm = searchTerm.toLowerCase().trim();

        return customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(normalizedSearchTerm) ||
            (customer.contactName &&
              customer.contactName.toLowerCase().includes(normalizedSearchTerm))
        );
      })
    );
  }

  /**
   * Get customer categories (distinct list)
   */
  getCustomerCategories(): Observable<string[]> {
    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const categoriesSet = new Set<string>();

        snapshot.docs.forEach((doc) => {
          const customer = doc.data();
          if (customer['category']) {
            categoriesSet.add(customer['category']);
          }
        });

        return Array.from(categoriesSet).sort();
      }),
      catchError((error) => {
        console.error('Error fetching customer categories:', error);
        return of([]);
      })
    );
  }

  /**
   * Convert Firestore document data to Customer model
   */
  private convertFirebaseCustomerToModel(id: string, data: any): Customer {
    // Handle Firebase timestamps
    const convertTimestamp = (timestamp: any): Date | undefined => {
      if (!timestamp) return undefined;

      // Firebase timestamp object with toDate() method
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return timestamp.toDate();
      }

      // String or number timestamp
      if (timestamp) {
        return new Date(timestamp);
      }

      return undefined;
    };

    return {
      id,
      name: data.name || '',
      address: data.address,
      category: data.category,
      city: data.city,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactPosition: data.contactPosition,
      country: data.country,
      email: data.email,
      isActive: data.isActive !== false,
      postcode: data.postcode,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  }
}
