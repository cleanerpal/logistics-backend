import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';

import { Customer } from '../../../interfaces/customer.interface';
import { Job } from '../../../interfaces/job.interface';
import { CustomerService } from '../../../services/customer.service';
import { ExpenseService } from '../../../services/expense.service';
import { JobService } from '../../../services/job.service';
import { AuthService } from '../../../services/auth.service';
import { Expense, ExpenseStatus } from '../../../shared/models/expense.model';

@Component({
  selector: 'app-expense-create',
  templateUrl: './expense-create.component.html',
  styleUrls: ['./expense-create.component.scss'],
  standalone: false,
})
export class ExpenseCreateComponent implements OnInit {
  expenseForm: FormGroup;
  isSubmitting = false;
  isLoading = true;
  jobId: string | null = null;
  job: Job | null = null;
  customer: Customer | null = null;
  errorMessage: string | null = null;
  jobLoading = false;
  availableJobs: Job[] = [];

  currentUserId: string | null = null;
  currentUserName: string = '';

  constructor(
    private fb: FormBuilder,
    private expenseService: ExpenseService,
    private jobService: JobService,
    private customerService: CustomerService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.expenseForm = this.fb.group({
      jobId: [''],
      description: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      date: [new Date(), Validators.required],
      notes: [''],
      isChargeable: [true],
      receiptUrl: [''],
    });
  }

  ngOnInit(): void {
    this.authService.getUserProfile().subscribe((profile) => {
      if (profile) {
        this.currentUserId = profile.id;
        this.currentUserName = profile.name;
      }
    });

    this.route.paramMap.subscribe((params) => {
      this.jobId = params.get('jobId');

      if (this.jobId) {
        this.expenseForm.patchValue({ jobId: this.jobId });
        this.loadJobDetails(this.jobId);
      } else {
        this.loadAvailableJobs();
        this.isLoading = false;
      }
    });

    this.expenseForm.get('jobId')?.valueChanges.subscribe((jobId) => {
      if (jobId && jobId !== this.jobId) {
        this.loadJobDetails(jobId);
      }
    });
  }

  loadJobDetails(jobId: string): void {
    this.jobLoading = true;
    this.errorMessage = null;

    this.jobService
      .getJobById(jobId)
      .pipe(
        tap((job) => {
          this.job = job;
          if (job && job.customerId) {
            return this.customerService.getCustomerById(job.customerId);
          }
          return of(null);
        }),
        switchMap((customerObs) => {
          if (customerObs instanceof Observable) {
            return customerObs;
          }
          return of(null);
        }),
        finalize(() => {
          this.jobLoading = false;
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (customer: Customer | null) => {
          this.customer = customer;

          if (this.job) {
            const description = `Invoice for ${this.job.make || ''} ${this.job.model || ''} ${this.job.registration ? '(' + this.job.registration + ')' : ''}`;
            this.expenseForm.patchValue({
              description: description,
            });
          }
        },
        error: (error) => {
          this.errorMessage = 'Failed to load job details. Please try again.';
          console.error('Error loading job details:', error);
        },
      });
  }

  loadAvailableJobs(): void {
    this.isLoading = true;
    this.jobService
      .getDriverJobs()
      .pipe(
        map((jobs) => jobs.filter((job) => job.status === 'completed' || job.status === 'delivered')),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (jobs) => {
          this.availableJobs = jobs;
        },
        error: (error) => {
          console.error('Error loading available jobs:', error);
          this.showErrorMessage('Failed to load available jobs. Please try again.');
        },
      });
  }

  onSubmit(): void {
    // Expense creation is now managed via the job/invoice system.
    this.showErrorMessage('Expenses must be added via the job details page or invoice system.');
  }

  uploadReceipt(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];

      this.expenseForm.patchValue({
        receiptUrl: 'assets/images/receipt-placeholder.jpg',
      });
    }
  }

  cancelCreate(): void {
    this.router.navigate(['/expenses']);
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  private showErrorMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }
}
