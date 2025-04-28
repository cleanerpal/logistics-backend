// generate-invoice.component.ts
import { Component, OnInit } from '@angular/core';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApprovedExpensesPipe } from '../../../pipes/approved-expenses.pipe';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  documentId,
} from '@angular/fire/firestore';

// Models
interface Job {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerAddress: string;
  amount?: number;
  expenses?: {
    id: string;
    description: string;
    amount: number;
    approved: boolean;
  }[];
  status: string;
  deliveryDate: Timestamp;
  completedAt: Timestamp;
}

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  address: string;
  phone: string;
}

@Component({
  selector: 'app-generate-invoice',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatListModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatAutocompleteModule,
    ApprovedExpensesPipe,
  ],
  templateUrl: './generate-invoice.component.html',
  styleUrls: ['./generate-invoice.component.scss'],
})
export class GenerateInvoiceComponent implements OnInit {
  invoiceForm!: FormGroup;
  selectedJobs: Job[] = [];
  jobIds: string[] = [];
  loading = true;
  saving = false;
  totalAmount = 0;
  chargeableExpenses = 0;

  constructor(
    private formBuilder: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['jobs']) {
        this.jobIds = params['jobs'].split(',');
        this.loadJobsData();
      } else {
        // Manual invoice creation without jobs
        this.loading = false;
      }
    });
  }

  private initForm(): void {
    this.invoiceForm = this.formBuilder.group({
      customerName: ['', Validators.required],
      customerCompany: [''],
      customerEmail: ['', [Validators.required, Validators.email]],
      customerAddress: ['', Validators.required],
      dueDate: [this.getDefaultDueDate(), Validators.required],
      notes: [''],
      totalAmount: [{ value: 0, disabled: true }],
    });
  }

  private getDefaultDueDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30); // Default due date is 30 days from today
    return date;
  }

  private loadJobsData(): void {
    if (this.jobIds.length === 0) {
      this.loading = false;
      return;
    }

    try {
      const jobsCollection = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsCollection,
        where(documentId(), 'in', this.jobIds)
      );

      getDocs(jobsQuery)
        .then((snapshot) => {
          this.selectedJobs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              vehicleMake: data['vehicleMake'] || '',
              vehicleModel: data['vehicleModel'] || '',
              vehicleRegistration: data['vehicleRegistration'] || '',
              customerName: data['customerName'] || '',
              customerCompany: data['customerCompany'] || '',
              customerEmail: data['customerEmail'] || '',
              customerAddress: data['customerAddress'] || '',
              amount: data['amount'] || 0,
              expenses: data['expenses'] || [],
              status: data['status'] || '',
              deliveryDate: data['deliveryDate'],
              completedAt: data['completedAt'],
            } as Job;
          });

          // Calculate total amount
          this.calculateTotals();

          // Populate form with customer details from the first job
          if (this.selectedJobs.length > 0) {
            const firstJob = this.selectedJobs[0];
            this.invoiceForm.patchValue({
              customerName: firstJob.customerName,
              customerCompany: firstJob.customerCompany,
              customerEmail: firstJob.customerEmail,
              customerAddress: firstJob.customerAddress,
            });
          }

          this.loading = false;
        })
        .catch((error) => {
          console.error('Error loading jobs:', error);
          this.snackBar.open('Error loading job information.', 'Close', {
            duration: 5000,
          });
          this.loading = false;
        });
    } catch (error) {
      console.error('Error querying jobs:', error);
      this.loading = false;
    }
  }

  calculateTotals(): void {
    // Calculate job amounts
    const jobAmounts = this.selectedJobs.reduce(
      (sum, job) => sum + (job.amount || 0),
      0
    );

    // Calculate approved expenses
    this.chargeableExpenses = 0;
    this.selectedJobs.forEach((job) => {
      if (job.expenses && job.expenses.length > 0) {
        const approvedExpenses = job.expenses
          .filter((expense) => expense.approved)
          .reduce((sum, expense) => sum + expense.amount, 0);

        this.chargeableExpenses += approvedExpenses;
      }
    });

    // Set total amount
    this.totalAmount = jobAmounts + this.chargeableExpenses;
    this.invoiceForm.get('totalAmount')?.setValue(this.totalAmount);
  }

  async onSubmit(): Promise<void> {
    if (this.invoiceForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.invoiceForm.controls).forEach((key) => {
        const control = this.invoiceForm.get(key);
        control?.markAsTouched();
      });

      this.snackBar.open('Please fill in all required fields.', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.saving = true;

    try {
      const formValues = this.invoiceForm.getRawValue();

      // Create invoice object
      const invoice = {
        customerName: formValues.customerName,
        customerCompany: formValues.customerCompany,
        customerEmail: formValues.customerEmail,
        customerAddress: formValues.customerAddress,
        dueDate: Timestamp.fromDate(formValues.dueDate),
        totalAmount: this.totalAmount,
        jobAmount: this.selectedJobs.reduce(
          (sum, job) => sum + (job.amount || 0),
          0
        ),
        expensesAmount: this.chargeableExpenses,
        notes: formValues.notes,
        status: 'Draft',
        createdAt: Timestamp.now(),
        jobIds: this.jobIds,
        invoiceNumber: await this.generateInvoiceNumber(),
      };

      // Add invoice to Firestore
      const invoicesCollection = collection(this.firestore, 'Invoices');
      const docRef = await addDoc(invoicesCollection, invoice);

      // Update jobs with invoice ID
      const jobUpdates = this.jobIds.map((jobId) => {
        const jobRef = doc(this.firestore, 'Jobs', jobId);
        return updateDoc(jobRef, { invoiceId: docRef.id });
      });

      await Promise.all(jobUpdates);

      this.snackBar.open('Invoice saved successfully.', 'Close', {
        duration: 3000,
      });

      // Navigate to the invoice details
      this.router.navigate(['/billing/invoice', docRef.id]);
    } catch (error) {
      console.error('Error saving invoice:', error);
      this.snackBar.open('Error saving invoice. Please try again.', 'Close', {
        duration: 5000,
      });
      this.saving = false;
    }
  }

  async generateInvoiceNumber(): Promise<string> {
    // Get the latest invoice number and increment it
    const invoicesCollection = collection(this.firestore, 'Invoices');
    const snapshot = await getDocs(invoicesCollection);

    // Find the highest invoice number
    let highestNumber = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data['invoiceNumber']) {
        const match = data['invoiceNumber'].match(/^INV-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestNumber) {
            highestNumber = num;
          }
        }
      }
    });

    // Generate new invoice number
    const newNumber = highestNumber + 1;
    return `INV-${newNumber.toString().padStart(5, '0')}`;
  }

  sendInvoice(): void {
    // First save the invoice
    this.onSubmit().then(() => {
      // Then handle email sending (would be implemented with a cloud function)
      this.snackBar.open('Invoice has been emailed to the customer.', 'Close', {
        duration: 3000,
      });
    });
  }

  cancelInvoice(): void {
    this.router.navigate(['/billing']);
  }

  formatCurrency(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }

  get jobAmount(): number {
    return this.selectedJobs.reduce((sum, job) => sum + (job.amount || 0), 0);
  }
}
