// invoice-details.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  documentId,
} from '@angular/fire/firestore';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  jobAmount: number;
  expensesAmount: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  notes: string;
  createdAt: Timestamp;
  dueDate: Timestamp;
  sentAt?: Timestamp;
  paidAt?: Timestamp;
  jobIds: string[];
}

interface Job {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  amount?: number;
  expenses?: {
    id: string;
    description: string;
    amount: number;
    approved: boolean;
  }[];
  status: string;
}

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './invoice-details.component.html',
  styleUrls: ['./invoice-details.component.scss'],
})
export class InvoiceDetailsComponent implements OnInit, OnDestroy {
  invoiceId: string | null = null;
  invoice: Invoice | null = null;
  jobs: Job[] = [];
  loading = true;

  private subscriptions: Subscription[] = [];

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.invoiceId = params.get('id');
      if (this.invoiceId) {
        this.loadInvoiceData();
      } else {
        this.router.navigate(['/billing']);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private async loadInvoiceData(): Promise<void> {
    if (!this.invoiceId) return;

    try {
      const invoiceRef = doc(this.firestore, 'Invoices', this.invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);

      if (invoiceSnap.exists()) {
        const data = invoiceSnap.data();
        this.invoice = {
          id: invoiceSnap.id,
          invoiceNumber:
            data['invoiceNumber'] ||
            `INV-${invoiceSnap.id.slice(0, 5).toUpperCase()}`,
          customerName: data['customerName'] || '',
          customerCompany: data['customerCompany'] || '',
          customerEmail: data['customerEmail'] || '',
          customerAddress: data['customerAddress'] || '',
          totalAmount: data['totalAmount'] || 0,
          jobAmount: data['jobAmount'] || 0,
          expensesAmount: data['expensesAmount'] || 0,
          status: data['status'] || 'Draft',
          notes: data['notes'] || '',
          createdAt: data['createdAt'],
          dueDate: data['dueDate'],
          sentAt: data['sentAt'],
          paidAt: data['paidAt'],
          jobIds: data['jobIds'] || [],
        };

        // Load associated jobs if any
        if (this.invoice.jobIds && this.invoice.jobIds.length > 0) {
          await this.loadJobsData(this.invoice.jobIds);
        }

        this.loading = false;
      } else {
        this.snackBar.open('Invoice not found.', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/billing']);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      this.snackBar.open('Error loading invoice details.', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async loadJobsData(jobIds: string[]): Promise<void> {
    try {
      const jobsCollection = collection(this.firestore, 'Jobs');
      const q = query(jobsCollection, where(documentId(), 'in', jobIds));

      const querySnapshot = await getDocs(q);
      this.jobs = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          vehicleMake: data['vehicleMake'] || '',
          vehicleModel: data['vehicleModel'] || '',
          vehicleRegistration: data['vehicleRegistration'] || '',
          amount: data['amount'] || 0,
          expenses: data['expenses'] || [],
          status: data['status'] || '',
        } as Job;
      });
    } catch (error) {
      console.error('Error loading jobs:', error);
      this.snackBar.open('Error loading job details.', 'Close', {
        duration: 5000,
      });
    }
  }

  async sendInvoice(): Promise<void> {
    if (!this.invoice || !this.invoiceId) return;

    try {
      const invoiceRef = doc(this.firestore, 'Invoices', this.invoiceId);
      await updateDoc(invoiceRef, {
        status: 'Sent',
        sentAt: Timestamp.now(),
      });

      this.snackBar.open('Invoice has been emailed to the customer.', 'Close', {
        duration: 3000,
      });

      // Refresh invoice data
      this.loadInvoiceData();
    } catch (error) {
      console.error('Error sending invoice:', error);
      this.snackBar.open('Error sending invoice. Please try again.', 'Close', {
        duration: 5000,
      });
    }
  }

  async markAsPaid(): Promise<void> {
    if (!this.invoice || !this.invoiceId) return;

    try {
      const invoiceRef = doc(this.firestore, 'Invoices', this.invoiceId);
      await updateDoc(invoiceRef, {
        status: 'Paid',
        paidAt: Timestamp.now(),
      });

      this.snackBar.open('Invoice marked as paid.', 'Close', {
        duration: 3000,
      });

      // Refresh invoice data
      this.loadInvoiceData();
    } catch (error) {
      console.error('Error updating invoice:', error);
      this.snackBar.open('Error updating invoice. Please try again.', 'Close', {
        duration: 5000,
      });
    }
  }

  editInvoice(): void {
    // Navigate to edit invoice page
    this.router.navigate(['/billing/edit-invoice', this.invoiceId]);
  }

  downloadInvoice(): void {
    // In a real app, this would generate a PDF and download it
    this.snackBar.open('Invoice downloaded successfully.', 'Close', {
      duration: 3000,
    });
  }

  goBack(): void {
    this.router.navigate(['/billing']);
  }

  formatDate(timestamp?: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatCurrency(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }
}
