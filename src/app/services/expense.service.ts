import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { Expense, ExpenseStatus } from '../shared/models/expense.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private expenses: Expense[] = [];

  constructor(private notificationService: NotificationService) {
    this.generateMockExpenses();
  }

  getExpenses(): Observable<Expense[]> {
    return of([...this.expenses]).pipe(delay(500));
  }

  getPendingExpenses(): Observable<Expense[]> {
    const pendingExpenses = this.expenses.filter((expense) => expense.status === ExpenseStatus.PENDING);
    return of(pendingExpenses).pipe(delay(500));
  }

  getExpensesByDriver(driverId: string): Observable<Expense[]> {
    const driverExpenses = this.expenses.filter((expense) => expense.driverId === driverId);
    return of(driverExpenses).pipe(delay(500));
  }

  getExpensesByJob(jobId: string): Observable<Expense[]> {
    const jobExpenses = this.expenses.filter((expense) => expense.jobId === jobId);
    return of(jobExpenses).pipe(delay(500));
  }

  createExpense(expense: Omit<Expense, 'id' | 'status'>): Observable<Expense> {
    const baseExpense = {
      ...expense,
      id: `EXP${String(this.expenses.length + 1).padStart(4, '0')}`,
      status: ExpenseStatus.PENDING,
    };

    const newExpense = {
      ...baseExpense,
      isPaid: false,
    } as Expense;

    this.expenses.push(newExpense);

    this.notificationService.addNotification({
      type: 'info',
      title: 'New Invoice Submitted',
      message: `A new invoice for ${expense.amount.toFixed(2)} has been submitted by ${expense.driverName}`,
      actionUrl: '/expenses',
    });

    return of(newExpense).pipe(delay(500));
  }

  updateExpenseStatus(id: string, status: ExpenseStatus, approverInfo?: { approvedBy: string }): Observable<Expense> {
    const index = this.expenses.findIndex((expense) => expense.id === id);
    if (index !== -1) {
      const originalExpense = this.expenses[index];
      const updatedExpense = {
        ...originalExpense,
        status,
        approvedBy: approverInfo?.approvedBy,
        approvedDate: status === ExpenseStatus.APPROVED ? new Date() : undefined,
      };

      this.expenses[index] = updatedExpense;

      let notificationType: 'success' | 'warning';
      let notificationTitle: string;
      let notificationMessage: string;

      if (status === ExpenseStatus.APPROVED) {
        notificationType = 'success';
        notificationTitle = 'Invoice Approved';
        notificationMessage = `Your invoice ${updatedExpense.description} for ${updatedExpense.amount.toFixed(2)} has been approved`;
      } else {
        notificationType = 'warning';
        notificationTitle = 'Invoice Rejected';
        notificationMessage = `Your invoice ${updatedExpense.description} for ${updatedExpense.amount.toFixed(2)} has been rejected`;
      }

      this.notificationService.addNotification({
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: updatedExpense.jobId ? `/jobs/${updatedExpense.jobId}` : '/expenses',
      });

      return of(updatedExpense).pipe(delay(500));
    }

    throw new Error(`Expense with id ${id} not found`);
  }

  updateExpenseChargeableStatus(id: string, isChargeable: boolean): Observable<Expense> {
    const index = this.expenses.findIndex((expense) => expense.id === id);
    if (index !== -1) {
      const originalExpense = this.expenses[index];
      const updatedExpense = {
        ...originalExpense,
        isChargeable,
      };

      this.expenses[index] = updatedExpense;

      return of(updatedExpense).pipe(delay(500));
    }

    throw new Error(`Expense with id ${id} not found`);
  }

  updateExpensePaidStatus(id: string, isPaid: boolean): Observable<Expense> {
    const index = this.expenses.findIndex((expense) => expense.id === id);
    if (index !== -1) {
      const originalExpense = this.expenses[index];

      const updatedExpense = {
        ...originalExpense,
        isPaid,
        paidDate: isPaid ? new Date() : undefined,
      } as Expense;

      this.expenses[index] = updatedExpense;

      const notificationType = isPaid ? 'success' : 'info';
      const notificationTitle = isPaid ? 'Invoice Paid' : 'Invoice Marked as Unpaid';
      const notificationMessage = isPaid ? `Invoice ${updatedExpense.id} has been marked as paid` : `Invoice ${updatedExpense.id} has been marked as unpaid`;

      this.notificationService.addNotification({
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actionUrl: '/expenses',
      });

      return of(updatedExpense).pipe(delay(500));
    }

    throw new Error(`Expense with id ${id} not found`);
  }

  private generateMockExpenses(): void {
    this.expenses = Array(15)
      .fill(null)
      .map((_, index) => {
        const baseExpense = {
          id: `EXP${String(index + 1).padStart(4, '0')}`,
          driverId: `DRV${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}`,
          driverName: `Driver ${Math.floor(Math.random() * 5) + 1}`,
          description: `Invoice ${index + 1}`,
          amount: Math.floor(Math.random() * 200) + 20,
          date: new Date(2024, 0, Math.floor(Math.random() * 30) + 1),
          status: this.getRandomStatus(),
          isChargeable: Math.random() > 0.5,
          jobId: Math.random() > 0.3 ? `JOB${String(Math.floor(Math.random() * 10) + 1).padStart(4, '0')}` : undefined,
          notes: Math.random() > 0.7 ? 'Additional notes about this invoice' : undefined,
        };

        return {
          ...baseExpense,
          isPaid: Math.random() > 0.7,
          paidDate: Math.random() > 0.7 ? new Date(2024, 0, Math.floor(Math.random() * 30) + 1) : undefined,
        } as Expense;
      });
  }

  private getRandomStatus(): ExpenseStatus {
    const statuses = [ExpenseStatus.PENDING, ExpenseStatus.APPROVED, ExpenseStatus.REJECTED];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}
