import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { JobStatus } from '../../../shared/models/job-status.enum';
import { VehicleType } from '../../../shared/models/vehicle-type.enum';
import { Expense, ExpenseStatus } from '../../../shared/models/expense.model';
import { ExpenseService } from '../../../services/expense.service';

interface Note {
  author: string;
  content: string;
  date: Date;
}

interface Job {
  id: string;
  status: JobStatus;
  currentDriver?: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    company: string;
  };
  vehicle: {
    make: string;
    model: string;
    type: VehicleType;
    registration: string;
    chassisNumber: string;
    shippingRef?: string;
  };
  addresses: {
    collection: {
      street: string;
      town: string;
      postcode: string;
      instructions: string;
    };
    delivery: {
      street: string;
      town: string;
      postcode: string;
      instructions: string;
    };
  };
  driver: {
    name: string;
    phone: string;
    currentLocation: string;
    assignedDate: Date;
  };
  notes: Note[];
  timeline: {
    date: Date;
    status: string;
    description: string;
    actor: string;
  }[];
}

@Component({
    selector: 'app-job-details',
    templateUrl: './job-details.component.html',
    styleUrls: ['./job-details.component.scss'],
    standalone: false
})
export class JobDetailsComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  jobId: string = '';
  activeTab: 'details' | 'timeline' | 'expenses' = 'details';
  isManager = true; // In a real app, this would be determined by user role
  job!: Job;
  expenses: Expense[] = [];
  statusOptions = Object.values(JobStatus);

  // Notes functionality
  newNote: string = '';

  // Expense functionality
  showAddExpenseForm = false;
  expenseForm!: FormGroup;
  receiptFile: File | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private expenseService: ExpenseService
  ) {
    this.createExpenseForm();
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      this.loadJobDetails(this.jobId);
      this.loadJobExpenses(this.jobId);
    });
  }

  private createExpenseForm(): void {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      notes: [''],
    });
  }

  loadJobDetails(jobId: string) {
    // In a real app, this would be an API call
    setTimeout(() => {
      this.job = {
        id: jobId,
        status: JobStatus.ALLOCATED,
        currentDriver: 'Mike Johnson',
        customer: {
          name: 'John Smith',
          phone: '+44 123 456 7890',
          email: 'john.smith@email.com',
          company: 'Smith Enterprises',
        },
        vehicle: {
          make: 'Toyota',
          model: 'Corolla',
          type: VehicleType.CAR,
          registration: 'AB12XYZ',
          chassisNumber: 'TYT123456789',
          shippingRef: 'SHIP1234',
        },
        addresses: {
          collection: {
            street: '123 Collection St',
            town: 'Belfast',
            postcode: 'SW1A 1AA',
            instructions: 'Call 30 minutes before arrival',
          },
          delivery: {
            street: '456 Delivery Rd',
            town: 'Edinburgh',
            postcode: 'EH1 1BB',
            instructions: 'Goods entrance at rear of building',
          },
        },
        driver: {
          name: 'Mike Johnson',
          phone: '+44 987 654 3210',
          currentLocation: 'En route to delivery',
          assignedDate: new Date(),
        },
        notes: [
          {
            author: 'Sarah Admin',
            content: 'Customer requested delivery before noon.',
            date: new Date(Date.now() - 24 * 3600000),
          },
          {
            author: 'Mike Johnson',
            content: 'Vehicle collected, everything in order.',
            date: new Date(Date.now() - 12 * 3600000),
          },
        ],
        timeline: [
          {
            date: new Date(Date.now() - 24 * 3600000),
            status: JobStatus.LOADED,
            description: 'Job created and vehicle loaded at depot',
            actor: 'Sarah Admin',
          },
          {
            date: new Date(Date.now() - 20 * 3600000),
            status: JobStatus.ALLOCATED,
            description: 'Job assigned to Mike Johnson',
            actor: 'System',
          },
          {
            date: new Date(Date.now() - 12 * 3600000),
            status: JobStatus.COLLECTED,
            description: 'Vehicle collected from depot',
            actor: 'Mike Johnson',
          },
        ],
      };
    }, 1000);
  }

  loadJobExpenses(jobId: string) {
    this.expenseService
      .getExpensesByJob(jobId)
      .subscribe((expenses: Expense[]) => {
        this.expenses = expenses;
      });
  }

  setActiveTab(tab: 'details' | 'timeline' | 'expenses') {
    this.activeTab = tab;
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      [JobStatus.LOADED]: 'status-loaded',
      [JobStatus.ALLOCATED]: 'status-allocated',
      [JobStatus.COLLECTED]: 'status-collected',
      [JobStatus.DELIVERED]: 'status-delivered',
      [JobStatus.ABORTED]: 'status-aborted',
      [JobStatus.CANCELLED]: 'status-cancelled',
    };
    return statusMap[status] || 'status-default';
  }

  getTimelineIcon(status: string): string {
    const iconMap: Record<string, string> = {
      [JobStatus.LOADED]: 'inventory_2',
      [JobStatus.ALLOCATED]: 'assignment',
      [JobStatus.COLLECTED]: 'departure_board',
      [JobStatus.DELIVERED]: 'check_circle',
      [JobStatus.ABORTED]: 'error',
      [JobStatus.CANCELLED]: 'cancel',
    };
    return iconMap[status] || 'radio_button_unchecked';
  }

  getExpenseStatusClass(status: ExpenseStatus): string {
    const statusMap: Record<string, string> = {
      [ExpenseStatus.PENDING]: 'status-pending',
      [ExpenseStatus.APPROVED]: 'status-approved',
      [ExpenseStatus.REJECTED]: 'status-rejected',
    };
    return statusMap[status] || 'status-default';
  }

  updateJobStatus(newStatus: JobStatus): void {
    if (this.job.status === newStatus) return;

    // In a real app, this would be an API call
    this.job.status = newStatus;

    // Add to timeline
    this.job.timeline.push({
      date: new Date(),
      status: newStatus,
      description: `Status updated to ${newStatus}`,
      actor: 'Current User', // In a real app, this would be the logged-in user
    });

    // Sort timeline by date (newest first)
    this.job.timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  addNote(): void {
    if (!this.newNote.trim()) return;

    // Add the note
    this.job.notes.push({
      author: 'Current User', // In a real app, this would be the logged-in user
      content: this.newNote.trim(),
      date: new Date(),
    });

    // Clear the input
    this.newNote = '';
  }

  editJob(): void {
    this.router.navigate(['/jobs', this.jobId, 'edit']);
  }

  printJobDetails(): void {
    window.print();
  }

  isLastEvent(event: any): boolean {
    return this.job.timeline.indexOf(event) === 0; // Timeline is sorted newest first
  }

  // Expense Management
  openAddExpenseForm(): void {
    this.showAddExpenseForm = true;
    this.expenseForm.reset({
      date: new Date().toISOString().substring(0, 10),
    });
    this.receiptFile = null;
  }

  closeAddExpenseForm(): void {
    this.showAddExpenseForm = false;
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.receiptFile = input.files[0];
    }
  }

  submitExpense(): void {
    if (this.expenseForm.invalid) return;

    const formValue = this.expenseForm.value;

    // Create expense object
    const expense: Omit<Expense, 'id' | 'status'> = {
      jobId: this.jobId,
      driverId: 'DRIVER1', // In a real app, this would be the logged-in driver's ID
      driverName: 'Current User', // In a real app, this would be the logged-in user's name
      description: formValue.description,
      amount: parseFloat(formValue.amount),
      date: new Date(formValue.date),
      notes: formValue.notes,
      receiptUrl: this.receiptFile
        ? URL.createObjectURL(this.receiptFile)
        : undefined,
      isChargeable: false, // Initially not chargeable until approved and marked
    };

    // Save expense
    this.expenseService
      .createExpense(expense)
      .subscribe((newExpense: Expense) => {
        this.expenses.push(newExpense);
        this.closeAddExpenseForm();
      });
  }

  approveExpense(expense: Expense): void {
    this.expenseService
      .updateExpenseStatus(
        expense.id,
        ExpenseStatus.APPROVED,
        { approvedBy: 'Current Manager' } // In a real app, this would be the logged-in manager
      )
      .subscribe((updatedExpense: Expense) => {
        // Update expense in the list
        const index = this.expenses.findIndex(
          (e) => e.id === updatedExpense.id
        );
        if (index !== -1) {
          this.expenses[index] = updatedExpense;
        }
      });
  }

  rejectExpense(expense: Expense): void {
    this.expenseService
      .updateExpenseStatus(
        expense.id,
        ExpenseStatus.REJECTED,
        { approvedBy: 'Current Manager' } // In a real app, this would be the logged-in manager
      )
      .subscribe((updatedExpense: Expense) => {
        // Update expense in the list
        const index = this.expenses.findIndex(
          (e) => e.id === updatedExpense.id
        );
        if (index !== -1) {
          this.expenses[index] = updatedExpense;
        }
      });
  }

  updateExpenseChargeable(expense: Expense, isChargeable: boolean): void {
    this.expenseService
      .updateExpenseChargeableStatus(expense.id, isChargeable)
      .subscribe((updatedExpense: Expense) => {
        // Update expense in the list
        const index = this.expenses.findIndex(
          (e) => e.id === updatedExpense.id
        );
        if (index !== -1) {
          this.expenses[index] = updatedExpense;
        }
      });
  }

  viewExpenseDetails(expense: Expense): void {
    // In a real app, this might open a modal with more details
    console.log('View expense details', expense);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  }
}
