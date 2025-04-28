import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  addDoc,
  Timestamp,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from '@angular/fire/storage';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.scss'],
})
export class ExpenseFormComponent implements OnInit {
  expenseForm!: FormGroup;
  loading = false;
  submitting = false;

  // File upload
  selectedFile: File | null = null;
  uploadProgress = 0;
  isUploading = false;

  // Dropdown options
  expenseTypes = ['Fuel', 'Toll', 'Car Wash', 'Vacuum', 'Other'];
  drivers: { id: string; name: string }[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private firestore: Firestore,
    private storage: Storage,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDrivers();
  }

  /**
   * Initialize expense form
   */
  private initializeForm(): void {
    this.expenseForm = this.formBuilder.group({
      driverId: ['', Validators.required],
      type: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      date: [new Date(), Validators.required],
      notes: [''],
      receipt: [''],
    });
  }

  /**
   * Load drivers from Firestore for dropdown
   */
  private async loadDrivers(): Promise<void> {
    this.loading = true;

    try {
      const driversRef = collection(this.firestore, 'Users');
      const q = query(
        driversRef,
        where('role', '==', 'Driver'),
        orderBy('displayName')
      );

      const querySnapshot = await getDocs(q);
      this.drivers = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['displayName'] || 'Unknown Driver',
      }));

      this.loading = false;
    } catch (error) {
      console.error('Error loading drivers:', error);
      this.snackBar.open('Error loading drivers. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.loading = false;
    }
  }

  /**
   * Handle file selection for receipt upload
   */
  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length > 0) {
      this.selectedFile = element.files[0];

      // Update form control with file name for display
      this.expenseForm.get('receipt')?.setValue(this.selectedFile.name);
    }
  }

  /**
   * Upload file to Firebase Storage
   */
  private async uploadReceipt(): Promise<string | null> {
    if (!this.selectedFile) {
      return null;
    }

    this.isUploading = true;

    try {
      // Create a unique file path
      const filePath = `receipts/${new Date().getTime()}_${
        this.selectedFile.name
      }`;
      const fileRef = ref(this.storage, filePath);

      // Start upload
      const uploadTask = uploadBytesResumable(fileRef, this.selectedFile);

      // Wait for upload to complete
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Update progress
            this.uploadProgress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
          },
          (error) => {
            // Handle error
            console.error('Upload failed:', error);
            this.isUploading = false;
            reject(null);
          },
          async () => {
            // Handle success
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            this.isUploading = false;
            resolve(downloadUrl);
          }
        );
      });
    } catch (error) {
      console.error('Error during upload:', error);
      this.isUploading = false;
      return null;
    }
  }

  /**
   * Submit the form to create a new expense
   */
  async onSubmit(): Promise<void> {
    if (this.expenseForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.expenseForm.controls).forEach((key) => {
        const control = this.expenseForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.submitting = true;

    try {
      // Upload receipt if one was selected
      let receiptUrl = null;
      if (this.selectedFile) {
        receiptUrl = await this.uploadReceipt();
      }

      // Get driver name
      const selectedDriverId = this.expenseForm.get('driverId')?.value;
      const selectedDriver = this.drivers.find(
        (d) => d.id === selectedDriverId
      );

      // Create expense data object
      const expenseData = {
        driverId: selectedDriverId,
        driverName: selectedDriver?.name || 'Unknown Driver',
        type: this.expenseForm.get('type')?.value,
        amount: parseFloat(this.expenseForm.get('amount')?.value),
        date: Timestamp.fromDate(this.expenseForm.get('date')?.value),
        notes: this.expenseForm.get('notes')?.value || '',
        receiptUrl: receiptUrl,
        status: 'Pending',
        chargeable: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Add to Firestore
      const expensesCollection = collection(this.firestore, 'Expenses');
      await addDoc(expensesCollection, expenseData);

      // Show success message
      this.snackBar.open('Expense created successfully', 'Close', {
        duration: 3000,
      });

      // Navigate back to expenses list
      this.router.navigate(['/expenses']);
    } catch (error) {
      console.error('Error creating expense:', error);
      this.snackBar.open('Error creating expense. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.submitting = false;
    }
  }

  /**
   * Cancel and return to expenses list
   */
  onCancel(): void {
    this.router.navigate(['/expenses']);
  }
}
