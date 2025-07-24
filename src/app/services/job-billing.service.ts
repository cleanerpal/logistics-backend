// src/app/services/job-billing.service.ts

import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  limit,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of, throwError, combineLatest } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { JobBillingItem, JobInvoice, BillingSettings, BillingDashboardStats } from '../interfaces/job-billing.interface';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class JobBillingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private billingItemsSubject = new BehaviorSubject<JobBillingItem[]>([]);
  private invoicesSubject = new BehaviorSubject<JobInvoice[]>([]);
  private settingsSubject = new BehaviorSubject<BillingSettings | null>(null);

  public loading$ = this.loadingSubject.asObservable();
  public billingItems$ = this.billingItemsSubject.asObservable();
  public invoices$ = this.invoicesSubject.asObservable();
  public settings$ = this.settingsSubject.asObservable();

  private currentUserId: string | null = null;

  constructor(private firestore: Firestore, private authService: AuthService, private emailService: EmailService, private notificationService: NotificationService) {
    this.authService.getUserProfile().subscribe((profile) => {
      this.currentUserId = profile?.id || null;
    });

    this.loadBillingSettings();
  }

  // Billing Items Management
  getJobBillingItems(jobId: string): Observable<JobBillingItem[]> {
    this.loadingSubject.next(true);

    const itemsRef = collection(this.firestore, 'jobBillingItems');
    const q = query(itemsRef, where('jobId', '==', jobId), orderBy('date', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const items = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              date: doc.data()['date']?.toDate() || new Date(),
              createdAt: doc.data()['createdAt']?.toDate() || new Date(),
              updatedAt: doc.data()['updatedAt']?.toDate() || new Date(),
            } as JobBillingItem)
        );

        this.billingItemsSubject.next(items);
        return items;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching job billing items:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  addBillingItem(item: Omit<JobBillingItem, 'id' | 'createdAt' | 'updatedAt'>): Observable<string> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const itemsRef = collection(this.firestore, 'jobBillingItems');
    const newItem = {
      ...item,
      createdBy: this.currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return from(addDoc(itemsRef, newItem)).pipe(
      map((docRef) => docRef.id),
      tap((itemId) => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Billing Item Added',
          message: `${item.description} has been added to job billing.`,
        });
      }),
      catchError((error) => {
        console.error('Error adding billing item:', error);
        return throwError(() => error);
      })
    );
  }

  updateBillingItem(itemId: string, updates: Partial<JobBillingItem>): Observable<void> {
    const itemRef = doc(this.firestore, 'jobBillingItems', itemId);
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    return from(updateDoc(itemRef, updateData)).pipe(
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Billing Item Updated',
          message: 'Billing item has been updated successfully.',
        });
      }),
      catchError((error) => {
        console.error('Error updating billing item:', error);
        return throwError(() => error);
      })
    );
  }

  deleteBillingItem(itemId: string): Observable<void> {
    const itemRef = doc(this.firestore, 'jobBillingItems', itemId);

    return from(deleteDoc(itemRef)).pipe(
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Billing Item Deleted',
          message: 'Billing item has been removed.',
        });
      }),
      catchError((error) => {
        console.error('Error deleting billing item:', error);
        return throwError(() => error);
      })
    );
  }

  // Job Invoice Management
  createInvoiceFromJob(jobId: string, customerDetails: any): Observable<string> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return combineLatest([this.getJobBillingItems(jobId), this.getBillingSettings()]).pipe(
      switchMap(([items, settings]) => {
        if (!settings) {
          return throwError(() => new Error('Billing settings not configured'));
        }

        const chargeableItems = items.filter((item) => item.isChargeable);
        const subtotal = chargeableItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
        const vatAmount = subtotal * (settings.vatRate / 100);
        const total = subtotal + vatAmount;

        const invoice: Omit<JobInvoice, 'id'> = {
          invoiceNumber: this.generateInvoiceNumber(settings),
          jobId,
          customerId: customerDetails.id,
          customerName: customerDetails.name,
          customerEmail: customerDetails.email,
          customerPhone: customerDetails.phone,
          billingAddress: customerDetails.billingAddress,
          items: chargeableItems,
          subtotal,
          vatRate: settings.vatRate,
          vatAmount,
          total,
          status: 'draft',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + settings.paymentTermsDays * 24 * 60 * 60 * 1000),
          createdBy: this.currentUserId || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const invoicesRef = collection(this.firestore, 'jobInvoices');
        return from(
          addDoc(invoicesRef, {
            ...invoice,
            issueDate: serverTimestamp(),
            dueDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        ).pipe(
          map((docRef) => docRef.id),
          tap(() => {
            this.updateInvoiceCounter(settings.nextInvoiceNumber + 1);
          })
        );
      }),
      catchError((error) => {
        console.error('Error creating invoice:', error);
        return throwError(() => error);
      })
    );
  }

  getJobInvoices(jobId: string): Observable<JobInvoice[]> {
    const invoicesRef = collection(this.firestore, 'jobInvoices');
    const q = query(invoicesRef, where('jobId', '==', jobId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              issueDate: doc.data()['issueDate']?.toDate() || new Date(),
              dueDate: doc.data()['dueDate']?.toDate() || new Date(),
              sentDate: doc.data()['sentDate']?.toDate(),
              paidDate: doc.data()['paidDate']?.toDate(),
              createdAt: doc.data()['createdAt']?.toDate() || new Date(),
              updatedAt: doc.data()['updatedAt']?.toDate() || new Date(),
            } as JobInvoice)
        );
      }),
      catchError((error) => {
        console.error('Error fetching job invoices:', error);
        return of([]);
      })
    );
  }

  getAllInvoices(limitCount?: number): Observable<JobInvoice[]> {
    const invoicesRef = collection(this.firestore, 'jobInvoices');
    let q = query(invoicesRef, orderBy('createdAt', 'desc'));

    if (limitCount) {
      q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(limitCount));
    }

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const invoices = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              issueDate: doc.data()['issueDate']?.toDate() || new Date(),
              dueDate: doc.data()['dueDate']?.toDate() || new Date(),
              sentDate: doc.data()['sentDate']?.toDate(),
              paidDate: doc.data()['paidDate']?.toDate(),
              createdAt: doc.data()['createdAt']?.toDate() || new Date(),
              updatedAt: doc.data()['updatedAt']?.toDate() || new Date(),
            } as JobInvoice)
        );

        this.invoicesSubject.next(invoices);
        return invoices;
      }),
      catchError((error) => {
        console.error('Error fetching invoices:', error);
        return of([]);
      })
    );
  }

  updateInvoiceStatus(invoiceId: string, status: JobInvoice['status'], additionalData?: Partial<JobInvoice>): Observable<void> {
    const invoiceRef = doc(this.firestore, 'jobInvoices', invoiceId);
    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
      ...additionalData,
    };

    if (status === 'sent' && !additionalData?.sentDate) {
      updateData.sentDate = serverTimestamp();
    }

    if (status === 'paid' && !additionalData?.paidDate) {
      updateData.paidDate = serverTimestamp();
    }

    return from(updateDoc(invoiceRef, updateData)).pipe(
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Invoice Updated',
          message: `Invoice status updated to ${status}.`,
        });
      }),
      catchError((error) => {
        console.error('Error updating invoice status:', error);
        return throwError(() => error);
      })
    );
  }

  // Email Invoice
  emailInvoice(invoiceId: string): Observable<void> {
    return this.getInvoiceById(invoiceId).pipe(
      switchMap((invoice) => {
        if (!invoice || !invoice.customerEmail) {
          return throwError(() => new Error('Invoice not found or customer email missing'));
        }

        return this.emailService.sendInvoice(invoice).pipe(switchMap(() => this.updateInvoiceStatus(invoiceId, 'sent')));
      }),
      catchError((error) => {
        console.error('Error emailing invoice:', error);
        return throwError(() => error);
      })
    );
  }

  // Settings Management
  private loadBillingSettings(): void {
    const settingsRef = doc(this.firestore, 'settings', 'billing');

    from(getDoc(settingsRef))
      .pipe(
        map((docSnap) => {
          if (docSnap.exists()) {
            return docSnap.data() as BillingSettings;
          }
          return this.getDefaultBillingSettings();
        }),
        catchError(() => of(this.getDefaultBillingSettings()))
      )
      .subscribe((settings) => {
        this.settingsSubject.next(settings);
      });
  }

  getBillingSettings(): Observable<BillingSettings | null> {
    return this.settings$;
  }

  updateBillingSettings(settings: Partial<BillingSettings>): Observable<void> {
    const settingsRef = doc(this.firestore, 'settings', 'billing');

    return from(updateDoc(settingsRef, settings)).pipe(
      tap(() => {
        this.loadBillingSettings();
        this.notificationService.addNotification({
          type: 'success',
          title: 'Settings Updated',
          message: 'Billing settings have been updated successfully.',
        });
      }),
      catchError((error) => {
        console.error('Error updating billing settings:', error);
        return throwError(() => error);
      })
    );
  }

  // Dashboard Stats
  getBillingDashboardStats(): Observable<BillingDashboardStats> {
    return this.getAllInvoices().pipe(
      map((invoices) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const totalOutstanding = invoices.filter((inv) => ['sent', 'viewed', 'outstanding', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + inv.total, 0);

        const totalPaid = invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);

        const overdueInvoices = invoices.filter((inv) => ['sent', 'viewed', 'outstanding'].includes(inv.status) && inv.dueDate < now);

        const thisMonthInvoices = invoices.filter((inv) => inv.issueDate.getMonth() === currentMonth && inv.issueDate.getFullYear() === currentYear);

        const thisMonthPaidInvoices = invoices.filter(
          (inv) => inv.status === 'paid' && inv.paidDate && inv.paidDate.getMonth() === currentMonth && inv.paidDate.getFullYear() === currentYear
        );

        const paidInvoices = invoices.filter((inv) => inv.status === 'paid' && inv.paidDate);
        const averagePaymentDays =
          paidInvoices.length > 0
            ? paidInvoices.reduce((sum, inv) => {
                const days = Math.ceil((inv.paidDate!.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24));
                return sum + days;
              }, 0) / paidInvoices.length
            : 0;

        return {
          totalOutstanding,
          totalPaid,
          overdueCount: overdueInvoices.length,
          overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.total, 0),
          thisMonthInvoiced: thisMonthInvoices.reduce((sum, inv) => sum + inv.total, 0),
          thisMonthPaid: thisMonthPaidInvoices.reduce((sum, inv) => sum + inv.total, 0),
          averagePaymentDays: Math.round(averagePaymentDays),
        };
      }),
      catchError((error) => {
        console.error('Error calculating dashboard stats:', error);
        return of({
          totalOutstanding: 0,
          totalPaid: 0,
          overdueCount: 0,
          overdueAmount: 0,
          thisMonthInvoiced: 0,
          thisMonthPaid: 0,
          averagePaymentDays: 0,
        });
      })
    );
  }

  // Helper Methods
  private getInvoiceById(invoiceId: string): Observable<JobInvoice | null> {
    const invoiceRef = doc(this.firestore, 'jobInvoices', invoiceId);

    return from(getDoc(invoiceRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return {
            id: docSnap.id,
            ...docSnap.data(),
            issueDate: docSnap.data()['issueDate']?.toDate() || new Date(),
            dueDate: docSnap.data()['dueDate']?.toDate() || new Date(),
            sentDate: docSnap.data()['sentDate']?.toDate(),
            paidDate: docSnap.data()['paidDate']?.toDate(),
            createdAt: docSnap.data()['createdAt']?.toDate() || new Date(),
            updatedAt: docSnap.data()['updatedAt']?.toDate() || new Date(),
          } as JobInvoice;
        }
        return null;
      })
    );
  }

  private generateInvoiceNumber(settings: BillingSettings): string {
    return `${settings.invoicePrefix}${settings.nextInvoiceNumber.toString().padStart(6, '0')}`;
  }

  private updateInvoiceCounter(newNumber: number): void {
    const settingsRef = doc(this.firestore, 'settings', 'billing');
    updateDoc(settingsRef, { nextInvoiceNumber: newNumber });
  }

  private getDefaultBillingSettings(): BillingSettings {
    return {
      vatRate: 20,
      paymentTermsDays: 30,
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      companyDetails: {
        name: 'NI VEHICLE LOGISTICS LTD',
        address: '55-59 Adelaide Street',
        city: 'Belfast',
        postcode: 'BT2 8FE',
        country: 'Northern Ireland',
        companyNumber: 'NI684159',
        email: 'info@nivehiclelogistics.com',
        phone: '+44 28 9024 4747',
      },
      bankDetails: {
        bankName: 'Example Bank',
        accountName: 'NI VEHICLE LOGISTICS LTD',
        sortCode: '00-00-00',
        accountNumber: '12345678',
      },
      emailTemplates: {
        invoiceSubject: 'Invoice {{invoiceNumber}} from {{companyName}}',
        invoiceBody:
          'Dear {{customerName}},\n\nPlease find attached invoice {{invoiceNumber}} for £{{total}}.\n\nPayment is due by {{dueDate}}.\n\nThank you for your business.',
        reminderSubject: 'Payment Reminder - Invoice {{invoiceNumber}}',
        reminderBody:
          'Dear {{customerName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for £{{total}} is now overdue.\n\nPlease arrange payment at your earliest convenience.',
      },
    };
  }
}
