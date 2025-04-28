import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-company-form',
  templateUrl: './company-form.component.html',
  styleUrls: ['./company-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
})
export class CompanyFormComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private formBuilder: FormBuilder = inject(FormBuilder);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  companyForm!: FormGroup;
  companyId: string | null = null;
  isEditMode = false;
  loading = false;
  saving = false;

  ngOnInit(): void {
    this.initForm();

    // Check if we are in edit mode
    this.route.paramMap.subscribe((params) => {
      this.companyId = params.get('id');

      if (this.companyId) {
        this.isEditMode = true;
        this.loadCompanyData(this.companyId);
      } else {
        this.loading = false;
      }
    });
  }

  /**
   * Initialize the company form
   */
  initForm(): void {
    this.companyForm = this.formBuilder.group({
      name: ['', Validators.required],
      companyName: ['', Validators.required],
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: [''],
      country: ['', Validators.required],
      postcode: [
        '',
        [
          Validators.required,
          Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
        ],
      ],
      phone: [
        '',
        [Validators.required, Validators.pattern(/^(\+44|0)\d{10}$/)],
      ],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  /**
   * Load company data in edit mode
   */
  async loadCompanyData(companyId: string): Promise<void> {
    this.loading = true;

    try {
      const companyRef = doc(this.firestore, 'Companies', companyId);
      const companySnap = await getDoc(companyRef);

      if (companySnap.exists()) {
        const companyData = companySnap.data();

        // Update form with company data
        this.companyForm.patchValue({
          name: companyData['name'] || '',
          companyName: companyData['companyName'] || '',
          street: companyData['street'] || '',
          city: companyData['city'] || '',
          state: companyData['state'] || '',
          country: companyData['country'] || '',
          postcode: companyData['postcode'] || '',
          phone: companyData['phone'] || '',
          email: companyData['email'] || '',
        });

        this.loading = false;
      } else {
        this.snackBar.open('Company not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/companies']);
      }
    } catch (error) {
      console.error('Error loading company data:', error);
      this.snackBar.open(
        'Error loading company data. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
      this.loading = false;
    }
  }

  /**
   * Form submission handler
   */
  async onSubmit(): Promise<void> {
    if (this.companyForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.companyForm);

      this.snackBar.open(
        'Please fix the validation errors before submitting.',
        'Close',
        {
          duration: 5000,
          panelClass: ['warning-snackbar'],
        }
      );
      return;
    }

    this.saving = true;

    try {
      const formData = this.companyForm.value;

      // Create company data object
      const companyData = {
        name: formData.name,
        companyName: formData.companyName,
        street: formData.street,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postcode: formData.postcode,
        phone: formData.phone,
        email: formData.email,
        updatedAt: Timestamp.now(),
      };

      if (this.isEditMode && this.companyId) {
        // Update existing company
        const companyRef = doc(this.firestore, 'Companies', this.companyId);
        await updateDoc(companyRef, companyData);

        this.snackBar.open('Company updated successfully.', 'Close', {
          duration: 3000,
        });
      } else {
        // Create new company
        const companiesCollection = collection(this.firestore, 'Companies');

        // Add created timestamp for new companies
        const newCompanyData = {
          ...companyData,
          createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(companiesCollection, newCompanyData);

        this.snackBar.open('Company created successfully.', 'Close', {
          duration: 3000,
        });

        // Navigate to edit mode for the new company
        this.router.navigate(['/companies/edit', docRef.id]);
      }

      this.saving = false;
    } catch (error) {
      console.error('Error saving company:', error);
      this.snackBar.open('Error saving company. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.saving = false;
    }
  }

  /**
   * Mark all controls in a form group as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Cancel and navigate back
   */
  onCancel(): void {
    this.router.navigate(['/companies']);
  }
}
