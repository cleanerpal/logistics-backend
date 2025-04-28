import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  onSnapshot,
  DocumentData,
} from '@angular/fire/firestore';

export interface ExpenseDetails {
  id: string;
  driverId: string;
  driverName: string;
  type: 'Fuel' | 'Toll' | 'Car Wash' | 'Vacuum' | 'Other';
  amount: number;
  date: Timestamp;
  notes?: string;
  receiptUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  chargeable: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Component({
  selector: 'app-expense-details',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './expense-details.component.html',
  styleUrls: ['./expense-details.component.scss'],
})
export class ExpenseDetailsComponent implements OnInit, OnDestroy {
  expenseId: string | null = null;
  expense: ExpenseDetails | null = null;
  loading = true;

  private unsubscribe?: () => void;

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.expenseId = params.get('id');
      if (this.expenseId) {
        this.loadExpenseDetails(this.expenseId);
      } else {
        this.router.navigate(['/expenses']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  /**
   * Load expense details with real-time updates
   */
  private loadExpenseDetails(id: string): void {
    this.loading = true;

    try {
      const docRef = doc(this.firestore, 'Expenses', id);
      this.unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as DocumentData;
            this.expense = {
              id: docSnap.id,
              driverId: data['driverId'] || '',
              driverName: data['driverName'] || 'Unknown Driver',
              type: data['type'] || 'Other',
              amount: data['amount'] || 0,
              date: data['date'] || Timestamp.now(),
              notes: data['notes'] || '',
              receiptUrl: data['receiptUrl'] || '',
              status: data['status'] || 'Pending',
              chargeable: data['chargeable'] || false,
              createdAt: data['createdAt'] || Timestamp.now(),
              updatedAt: data['updatedAt'] || Timestamp.now(),
            };
          } else {
            this.snackBar.open('Expense not found', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/expenses']);
          }
          this.loading = false;
        },
        (error) => {
          console.error('Error loading expense details:', error);
          this.snackBar.open('Error loading expense details', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.loading = false;
        }
      );
    } catch (error) {
      console.error('Error setting up expense subscription:', error);
      this.loading = false;
    }
  }

  /**
   * Navigate back to expenses list
   */
  goBack(): void {
    this.router.navigate(['/expenses']);
  }

  /**
   * Approve expense
   */
  async approveExpense(): Promise<void> {
    if (!this.expenseId) return;

    try {
      const expenseRef = doc(this.firestore, 'Expenses', this.expenseId);
      await updateDoc(expenseRef, {
        status: 'Approved',
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open('Expense approved', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error approving expense:', error);
      this.snackBar.open(
        'Error approving expense. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Reject expense
   */
  async rejectExpense(): Promise<void> {
    if (!this.expenseId) return;

    try {
      const expenseRef = doc(this.firestore, 'Expenses', this.expenseId);
      await updateDoc(expenseRef, {
        status: 'Rejected',
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open('Expense rejected', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error rejecting expense:', error);
      this.snackBar.open(
        'Error rejecting expense. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Toggle expense chargeable status
   */
  async toggleChargeable(): Promise<void> {
    if (!this.expenseId || !this.expense) return;

    try {
      const expenseRef = doc(this.firestore, 'Expenses', this.expenseId);
      await updateDoc(expenseRef, {
        chargeable: !this.expense.chargeable,
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open(
        `Expense marked as ${
          !this.expense.chargeable ? 'chargeable' : 'non-chargeable'
        }`,
        'Close',
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('Error updating expense chargeable status:', error);
      this.snackBar.open('Error updating expense. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Delete expense
   */
  confirmDelete(): void {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.deleteExpense();
    }
  }

  /**
   * Delete expense from Firestore
   */
  private async deleteExpense(): Promise<void> {
    if (!this.expenseId) return;

    try {
      const expenseRef = doc(this.firestore, 'Expenses', this.expenseId);
      await deleteDoc(expenseRef);

      this.snackBar.open('Expense deleted successfully', 'Close', {
        duration: 3000,
      });

      this.router.navigate(['/expenses']);
    } catch (error) {
      console.error('Error deleting expense:', error);
      this.snackBar.open('Error deleting expense. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * View receipt in new tab
   */
  viewReceipt(): void {
    if (this.expense?.receiptUrl) {
      window.open(this.expense.receiptUrl, '_blank');
    }
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Format amount with currency symbol
   */
  formatAmount(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }

  /**
   * Get status color for badge
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Approved':
        return '#4CAF50'; // Green
      case 'Rejected':
        return '#F44336'; // Red
      case 'Pending':
        return '#FFC107'; // Amber
      default:
        return '#9E9E9E'; // Grey
    }
  }
}
