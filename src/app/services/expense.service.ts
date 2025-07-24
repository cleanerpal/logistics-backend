import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap, map } from 'rxjs/operators';
import { Expense, ExpenseStatus } from '../shared/models/expense.model';
import { NotificationService } from './notification.service';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { from } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  constructor(private firestore: Firestore, private notificationService: NotificationService) {}

  getExpenses(): Observable<Expense[]> {
    // Fetch all invoice items of type 'expense' from all jobInvoices
    const invoicesRef = collection(this.firestore, 'jobInvoices');
    return from(getDocs(invoicesRef)).pipe(
      map((snapshot) => {
        const expenses: Expense[] = [];
        snapshot.forEach((doc) => {
          const invoice = doc.data();
          if (Array.isArray(invoice['items'])) {
            invoice['items'].forEach((item: any) => {
              if (item.type === 'expense') {
                expenses.push({
                  ...item,
                  jobId: invoice['jobId'],
                  id: item.id || `${doc.id}_${item.description}`,
                  date: item.date || invoice['issueDate'] || new Date(),
                  status: item.status || 'APPROVED',
                  driverId: item.driverId || '',
                  driverName: item.driverName || '',
                  isChargeable: item.isChargeable,
                  isPaid: item.isPaid || false,
                  paidDate: item.paidDate,
                  notes: item.notes,
                });
              }
            });
          }
        });
        return expenses;
      })
    );
  }
}
