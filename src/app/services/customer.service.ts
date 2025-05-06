import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Customer, CustomerContact, CustomerStatus } from '../interfaces/customer.interface';
import { BaseFirebaseService } from './base-firebase.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class CustomerService extends BaseFirebaseService {
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public customers$ = this.customersSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(protected override firestore: Firestore, protected override auth: Auth, private notificationService: NotificationService) {
    super(firestore, auth);
  }

  /**
   * Get all customers
   */
  getCustomers(): Observable<Customer[]> {
    this.loadingSubject.next(true);

    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('isActive', '==', true), orderBy('name', 'asc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const customers = snapshot.docs.map((doc) => {
          return this.convertFirebaseCustomerToModel(doc.id, doc.data());
        });
        this.customersSubject.next(customers);
        return customers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching customers:', error);
        this.loadingSubject.next(false);
        this.customersSubject.next([]);
        return of([]);
      })
    );
  }

  /**
   * Get customers by status
   */
  getCustomersByStatus(status: CustomerStatus): Observable<Customer[]> {
    this.loadingSubject.next(true);

    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('status', '==', status), where('isActive', '==', true), orderBy('name', 'asc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const customers = snapshot.docs.map((doc) => {
          return this.convertFirebaseCustomerToModel(doc.id, doc.data());
        });
        return customers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching customers with status ${status}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get customers by category
   */
  getCustomersByCategory(category: string): Observable<Customer[]> {
    this.loadingSubject.next(true);

    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('category', '==', category), where('isActive', '==', true), orderBy('name', 'asc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const customers = snapshot.docs.map((doc) => {
          return this.convertFirebaseCustomerToModel(doc.id, doc.data());
        });
        return customers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching customers with category ${category}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get a customer by ID
   */
  getCustomerById(id: string): Observable<Customer | null> {
    this.loadingSubject.next(true);

    if (!id) {
      this.loadingSubject.next(false);
      return of(null);
    }

    const customerRef = doc(this.firestore, `customers/${id}`);

    return from(getDoc(customerRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseCustomerToModel(docSnap.id, docSnap.data());
        } else {
          return null;
        }
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching customer ${id}:`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  /**
   * Create a new customer
   */
  createCustomer(data: Partial<Customer>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // Ensure contacts have IDs
    const contacts =
      data.contacts?.map((contact) => {
        if (!contact.id) {
          return { ...contact, id: this.generateId() };
        }
        return contact;
      }) || [];

    // Prepare customer data
    const customerData = {
      ...data,
      contacts: contacts,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
      status: data.status || CustomerStatus.ACTIVE,
      isActive: true,
    };

    const customersRef = collection(this.firestore, 'customers');

    return from(addDoc(customersRef, customerData)).pipe(
      map((docRef) => {
        // Refresh the customers list
        this.refreshCustomersList();

        // Add notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Customer Created',
          message: `Customer "${data.name}" has been created successfully`,
          actionUrl: `/customers/${docRef.id}`,
        });

        return docRef.id;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error creating customer:', error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing customer
   */
  updateCustomer(id: string, data: Partial<Customer>): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const customerRef = doc(this.firestore, `customers/${id}`);

    // Process contacts array
    let contacts = data.contacts || [];

    // Make sure all contacts have IDs
    contacts = contacts.map((contact) => {
      if (!contact.id) {
        return { ...contact, id: this.generateId() };
      }
      return contact;
    });

    // Remove id from update data to avoid overwriting it
    const { id: _, ...updateData } = data;

    // Add updater and timestamp
    const customerData = {
      ...updateData,
      contacts: contacts,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    return from(updateDoc(customerRef, customerData)).pipe(
      tap(() => {
        // Refresh the customers list
        this.refreshCustomersList();

        // Add notification about customer update
        this.notificationService.addNotification({
          type: 'info',
          title: 'Customer Updated',
          message: `Customer "${data.name}" has been updated`,
          actionUrl: `/customers/${id}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error updating customer ${id}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Soft delete a customer (mark as inactive)
   */
  deleteCustomer(id: string): Observable<void> {
    this.loadingSubject.next(true);

    const customerRef = doc(this.firestore, `customers/${id}`);

    // We'll do a soft delete by setting isActive to false
    const updateData = {
      isActive: false,
      updatedAt: serverTimestamp(),
      updatedBy: this.currentUserId,
    };

    return from(updateDoc(customerRef, updateData)).pipe(
      tap(() => {
        // Refresh the customers list
        this.refreshCustomersList();

        // Add notification
        this.notificationService.addNotification({
          type: 'warning',
          title: 'Customer Deleted',
          message: 'The customer has been deleted',
          actionUrl: '/customers',
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error deleting customer ${id}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get unique list of categories from all customers
   */
  getCategories(): Observable<string[]> {
    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const categoriesSet = new Set<string>();

        snapshot.docs.forEach((doc) => {
          const category = doc.data()['category'];
          if (category) {
            categoriesSet.add(category);
          }
        });

        return Array.from(categoriesSet).sort();
      }),
      catchError((error) => {
        console.error('Error fetching categories:', error);
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
          (customer) => customer.name.toLowerCase().includes(normalizedSearchTerm) || this.contactsIncludeSearchTerm(customer.contacts, normalizedSearchTerm)
        );
      })
    );
  }

  /**
   * Check if any contact information matches the search term
   */
  private contactsIncludeSearchTerm(contacts: CustomerContact[], searchTerm: string): boolean {
    if (!contacts || contacts.length === 0) return false;

    return contacts.some(
      (contact) =>
        (contact.name && contact.name.toLowerCase().includes(searchTerm)) ||
        (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
        (contact.phone && contact.phone.toLowerCase().includes(searchTerm)) ||
        (contact.position && contact.position.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Refresh the customers list
   */
  private refreshCustomersList(): void {
    // Only refresh if we have customers loaded already
    if (this.customersSubject.getValue().length > 0) {
      this.getCustomers().subscribe();
    }
  }

  /**
   * Generate a random ID for customer contacts
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Convert Firestore document to Customer model
   */
  private convertFirebaseCustomerToModel(id: string, data: any): Customer {
    // Process contacts array
    const contacts: CustomerContact[] = [];

    if (data.contacts && Array.isArray(data.contacts)) {
      data.contacts.forEach((contact: any) => {
        contacts.push({
          id: contact.id || this.generateId(),
          name: contact.name || '',
          position: contact.position,
          email: contact.email || '',
          phone: contact.phone,
          isPrimary: contact.isPrimary || false,
        });
      });
    }

    // Ensure at least one contact exists
    if (contacts.length === 0) {
      contacts.push({
        id: this.generateId(),
        name: '',
        email: '',
        isPrimary: true,
      });
    }

    return {
      id,
      name: data.name || '',
      phone: data.phone || '',
      industry: data.industry,
      category: data.category,
      size: data.size,
      status: data.status || CustomerStatus.ACTIVE,
      address: data.address,
      city: data.city,
      postcode: data.postcode,
      country: data.country,
      website: data.website,
      description: data.description,
      contacts: contacts,
      createdAt: this.convertTimestamp(data.createdAt) || new Date(),
      updatedAt: this.convertTimestamp(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      lastContact: this.convertTimestamp(data.lastContact),
      notes: data.notes,
      isActive: data.isActive !== false,
    };
  }
}
