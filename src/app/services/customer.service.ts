import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
} from '@angular/fire/firestore';

// Import Customer model
import { Customer, Address } from '../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private firestore: Firestore = inject(Firestore);

  /**
   * Get all customers
   */
  getCustomers(): Observable<Customer[]> {
    const customersRef = collection(this.firestore, 'Customers');
    const customersQuery = query(customersRef, orderBy('name'));

    return collectionData(customersQuery, { idField: 'id' }).pipe(
      map((customers) => customers as Customer[])
    );
  }

  /**
   * Get a customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const customerRef = doc(this.firestore, 'Customers', id);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
      return { id: customerSnap.id, ...customerSnap.data() } as Customer;
    }

    return null;
  }

  /**
   * Create a new customer
   */
  async createCustomer(
    customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const customersRef = collection(this.firestore, 'Customers');
    const docRef = await addDoc(customersRef, {
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return docRef.id;
  }

  /**
   * Update a customer
   */
  async updateCustomer(
    id: string,
    customerData: Partial<Customer>
  ): Promise<void> {
    const customerRef = doc(this.firestore, 'Customers', id);
    await updateDoc(customerRef, {
      ...customerData,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(id: string): Promise<void> {
    const customerRef = doc(this.firestore, 'Customers', id);
    await deleteDoc(customerRef);
  }

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    const customer = await this.getCustomerById(customerId);
    if (customer && customer.addresses) {
      return customer.addresses;
    }
    return [];
  }
}
