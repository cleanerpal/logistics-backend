import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Invoice, InvoiceItem, InvoiceStatus, PaymentStatus, InvoiceItemCategory, JobBilling } from '../interfaces/invoice.interface';
import { Expense } from '../interfaces/expense.interface';
import { Job } from '../interfaces/job.interface';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  public invoices$ = this.invoicesSubject.asObservable();

  private readonly INVOICES_COLLECTION = 'invoices';
  private readonly JOBS_COLLECTION = 'jobs';
  private readonly EXPENSES_COLLECTION = 'expenses';

  constructor(private firestore: Firestore, private authService: AuthService, private notificationService: NotificationService) {
    this.loadInvoices();
  }

  private async loadInvoices(): Promise<void> {
    try {
      const invoicesRef = collection(this.firestore, this.INVOICES_COLLECTION);
      const q = query(invoicesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const invoices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        invoiceDate: this.convertTimestamp(doc.data()['invoiceDate']),
        dueDate: this.convertTimestamp(doc.data()['dueDate']),
        createdAt: this.convertTimestamp(doc.data()['createdAt']),
        updatedAt: this.convertTimestamp(doc.data()['updatedAt']),
        paidDate: doc.data()['paidDate'] ? this.convertTimestamp(doc.data()['paidDate']) : undefined,
        approvedAt: doc.data()['approvedAt'] ? this.convertTimestamp(doc.data()['approvedAt']) : undefined,
        emailedAt: doc.data()['emailedAt'] ? this.convertTimestamp(doc.data()['emailedAt']) : undefined,
        printedAt: doc.data()['printedAt'] ? this.convertTimestamp(doc.data()['printedAt']) : undefined,
      })) as Invoice[];

      this.invoicesSubject.next(invoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
      this.invoicesSubject.next([]);
    }
  }

  getInvoices(): Observable<Invoice[]> {
    return this.invoices$;
  }

  getInvoiceById(id: string): Observable<Invoice | null> {
    return this.invoices$.pipe(map((invoices) => invoices.find((invoice) => invoice.id === id) || null));
  }

  getInvoicesByJob(jobId: string): Observable<Invoice[]> {
    return this.invoices$.pipe(map((invoices) => invoices.filter((invoice) => invoice.jobId === jobId)));
  }

  getInvoicesByStatus(status: InvoiceStatus): Observable<Invoice[]> {
    return this.invoices$.pipe(map((invoices) => invoices.filter((invoice) => invoice.status === status)));
  }

  getInvoicesByPaymentStatus(paymentStatus: PaymentStatus): Observable<Invoice[]> {
    return this.invoices$.pipe(map((invoices) => invoices.filter((invoice) => invoice.paymentStatus === paymentStatus)));
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6);
    return `INV-${year}${month}${day}-${time}`;
  }

  async createInvoiceFromJob(
    jobId: string,
    expenses: Expense[],
    additionalItems: Partial<InvoiceItem>[] = [],
    customerInfo?: {
      customerId?: string;
      customerName?: string;
      customerEmail?: string;
      customerAddress?: string;
    }
  ): Promise<Invoice> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const expenseItems: InvoiceItem[] = expenses.map((expense) => ({
        id: this.generateItemId(),
        description: expense.description,
        quantity: 1,
        unitPrice: expense.amount,
        amount: expense.amount,
        category: this.mapExpenseTypeToCategory(expense.type),
        expenseId: expense.id,
        notes: expense.notes,
      }));

      const additionalInvoiceItems: InvoiceItem[] = additionalItems.map((item) => ({
        id: this.generateItemId(),
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: (item.quantity || 1) * (item.unitPrice || 0),
        category: item.category || InvoiceItemCategory.OTHER,
        notes: item.notes,
      }));

      const allItems = [...expenseItems, ...additionalInvoiceItems];
      const subtotal = allItems.reduce((sum, item) => sum + item.amount, 0);
      const vatRate = 0.2; // 20% VAT
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      const now = new Date();
      const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const invoiceData: Omit<Invoice, 'id'> = {
        invoiceNumber: this.generateInvoiceNumber(),
        jobId,
        customerId: customerInfo?.customerId,
        customerName: customerInfo?.customerName,
        customerEmail: customerInfo?.customerEmail,
        customerAddress: customerInfo?.customerAddress,
        items: allItems,
        subtotal,
        vatRate,
        vatAmount,
        total,
        status: InvoiceStatus.DRAFT,
        paymentStatus: PaymentStatus.OUTSTANDING,
        invoiceDate: now,
        dueDate,
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
      };

      const invoicesRef = collection(this.firestore, this.INVOICES_COLLECTION);
      const docRef = await addDoc(invoicesRef, {
        ...invoiceData,
        invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate),
        dueDate: Timestamp.fromDate(invoiceData.dueDate),
        createdAt: Timestamp.fromDate(invoiceData.createdAt),
        updatedAt: Timestamp.fromDate(invoiceData.updatedAt),
      });

      const newInvoice: Invoice = {
        id: docRef.id,
        ...invoiceData,
      };

      const currentInvoices = this.invoicesSubject.value;
      this.invoicesSubject.next([newInvoice, ...currentInvoices]);

      this.notificationService.addNotification({
        type: 'success',
        title: 'Invoice Created',
        message: `Invoice ${newInvoice.invoiceNumber} has been created`,
        actionUrl: `/invoices/${newInvoice.id}`,
      });

      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const invoiceRef = doc(this.firestore, this.INVOICES_COLLECTION, invoiceId);
      const updateData: any = {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (status === InvoiceStatus.APPROVED) {
        updateData.approvedBy = currentUser.uid;
        updateData.approvedAt = Timestamp.fromDate(new Date());
      }

      await updateDoc(invoiceRef, updateData);

      this.updateLocalInvoice(invoiceId, updateData);

      this.notificationService.addNotification({
        type: 'info',
        title: 'Invoice Updated',
        message: `Invoice status updated to ${status}`,
        actionUrl: `/invoices/${invoiceId}`,
      });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
  }

  async updatePaymentStatus(invoiceId: string, paymentStatus: PaymentStatus, paidDate?: Date): Promise<void> {
    try {
      const invoiceRef = doc(this.firestore, this.INVOICES_COLLECTION, invoiceId);
      const updateData: any = {
        paymentStatus,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (paymentStatus === PaymentStatus.PAID && paidDate) {
        updateData.paidDate = Timestamp.fromDate(paidDate);
      }

      await updateDoc(invoiceRef, updateData);

      this.updateLocalInvoice(invoiceId, updateData);

      this.notificationService.addNotification({
        type: 'success',
        title: 'Payment Status Updated',
        message: `Invoice payment status updated to ${paymentStatus}`,
        actionUrl: `/invoices/${invoiceId}`,
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  async markAsEmailed(invoiceId: string, emailedTo: string[]): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const invoiceRef = doc(this.firestore, this.INVOICES_COLLECTION, invoiceId);
      const updateData = {
        emailedTo,
        emailedAt: Timestamp.fromDate(new Date()),
        status: InvoiceStatus.SENT,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      await updateDoc(invoiceRef, updateData);

      this.updateLocalInvoice(invoiceId, updateData);
    } catch (error) {
      console.error('Error marking invoice as emailed:', error);
      throw error;
    }
  }

  async markAsPrinted(invoiceId: string): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const invoiceRef = doc(this.firestore, this.INVOICES_COLLECTION, invoiceId);
      const updateData = {
        printedAt: Timestamp.fromDate(new Date()),
        printedBy: currentUser.uid,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      await updateDoc(invoiceRef, updateData);

      this.updateLocalInvoice(invoiceId, updateData);
    } catch (error) {
      console.error('Error marking invoice as printed:', error);
      throw error;
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      const invoiceRef = doc(this.firestore, this.INVOICES_COLLECTION, invoiceId);
      await deleteDoc(invoiceRef);

      const currentInvoices = this.invoicesSubject.value;
      const updatedInvoices = currentInvoices.filter((invoice) => invoice.id !== invoiceId);
      this.invoicesSubject.next(updatedInvoices);

      this.notificationService.addNotification({
        type: 'warning',
        title: 'Invoice Deleted',
        message: 'Invoice has been deleted',
        actionUrl: '/invoices',
      });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }

  async getJobBilling(jobId: string): Promise<JobBilling> {
    try {
      const invoices = (await this.getInvoicesByJob(jobId).toPromise()) || [];

      const expensesRef = collection(this.firestore, this.EXPENSES_COLLECTION);
      const expensesQuery = query(expensesRef, where('jobId', '==', jobId));
      const expensesSnapshot = await getDocs(expensesQuery);

      const expenses = expensesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[];

      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalChargeableExpenses = expenses.filter((expense) => expense.isChargeable).reduce((sum, expense) => sum + expense.amount, 0);

      let billingStatus: 'not_billed' | 'pending' | 'invoiced' | 'paid' = 'not_billed';

      if (invoices.length > 0) {
        const hasUnpaidInvoices = invoices.some((inv) => inv.paymentStatus !== PaymentStatus.PAID);
        const hasPaidInvoices = invoices.some((inv) => inv.paymentStatus === PaymentStatus.PAID);

        if (hasPaidInvoices && !hasUnpaidInvoices) {
          billingStatus = 'paid';
        } else if (invoices.some((inv) => inv.status === InvoiceStatus.SENT)) {
          billingStatus = 'invoiced';
        } else {
          billingStatus = 'pending';
        }
      }

      return {
        jobId,
        hasInvoice: invoices.length > 0,
        invoiceId: invoices[0]?.id,
        totalExpenses,
        totalChargeableExpenses,
        billingStatus,
        lastBilledDate: invoices[0]?.invoiceDate,
      };
    } catch (error) {
      console.error('Error getting job billing:', error);
      throw error;
    }
  }

  private generateItemId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private mapExpenseTypeToCategory(expenseType: string): InvoiceItemCategory {
    switch (expenseType) {
      case 'fuel':
        return InvoiceItemCategory.FUEL;
      case 'toll':
        return InvoiceItemCategory.TOLLS;
      case 'car_wash':
      case 'vacuum':
        return InvoiceItemCategory.MAINTENANCE;
      default:
        return InvoiceItemCategory.OTHER;
    }
  }

  private convertTimestamp(timestamp: any): Date {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return new Date();
  }

  private updateLocalInvoice(invoiceId: string, updateData: any): void {
    const currentInvoices = this.invoicesSubject.value;
    const updatedInvoices = currentInvoices.map((invoice) => {
      if (invoice.id === invoiceId) {
        return {
          ...invoice,
          ...updateData,
          updatedAt: updateData.updatedAt ? this.convertTimestamp(updateData.updatedAt) : new Date(),
        };
      }
      return invoice;
    });
    this.invoicesSubject.next(updatedInvoices);
  }
}
