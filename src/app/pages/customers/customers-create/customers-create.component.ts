// src/app/pages/companies/company-create/company-create.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CompanyService } from '../../../services/company.service';
import { NotificationService } from '../../../services/notification.service';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Company, CompanySize, CompanyStatus, CompanyContact } from '../../../interfaces/company.interface';

@Component({
  selector: 'app-company-create',
  templateUrl: './company-create.component.html',
  styleUrls: ['./company-create.component.scss'],
  standalone: false,
})
export class CompanyCreateComponent implements OnInit, OnDestroy {
  companyForm!: FormGroup;
  companyId: string | null = null;
  isEditMode = false;
  isSubmitting = false;
  isLoading = false;
  hasChanges = false;

  // Reference data
  industries = [
    'Technology',
    'Manufacturing',
    'Healthcare',
    'Finance',
    'Retail',
    'Education',
    'Construction',
    'Transportation',
    'Energy',
    'Telecommunications',
    'Agriculture',
    'Entertainment',
    'Hospitality',
    'Media',
    'Professional Services',
    'Real Estate',
    'Other',
  ];

  companySizes = [CompanySize.SMALL, CompanySize.MEDIUM, CompanySize.LARGE, CompanySize.ENTERPRISE];

  companyStatuses = [CompanyStatus.ACTIVE, CompanyStatus.INACTIVE, CompanyStatus.PENDING];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.companyId;

    if (this.isEditMode && this.companyId) {
      this.loadCompanyData(this.companyId);
    }

    // Track form changes
    const formChangeSub = this.companyForm.valueChanges.subscribe(() => {
      this.hasChanges = true;
    });
    this.subscriptions.push(formChangeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Create reactive form
   */
  private createForm(): void {
    this.companyForm = this.fb.group({
      name: ['', [Validators.required]],
      industry: ['', [Validators.required]],
      size: [CompanySize.SMALL, [Validators.required]],
      status: [CompanyStatus.ACTIVE, [Validators.required]],
      address: ['', [Validators.required]],
      city: [''],
      postcode: [''],
      country: [''],
      website: [''],
      description: [''],
      contacts: this.fb.array([this.createContactFormGroup(true)]),
      notes: [''],
    });
  }

  /**
   * Create contact form group
   */
  private createContactFormGroup(isPrimary: boolean = false): FormGroup {
    return this.fb.group({
      id: [''],
      name: ['', [Validators.required]],
      position: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      isPrimary: [isPrimary],
    });
  }

  /**
   * Load company data when in edit mode
   */
  private loadCompanyData(companyId: string): void {
    this.isLoading = true;

    // Retrieve company from Firestore using the service
    const companySub = this.companyService.getCompanyById(companyId).subscribe({
      next: (company) => {
        if (company) {
          this.populateForm(company);
        } else {
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Company not found',
          });
          this.router.navigate(['/companies']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading company:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load company data',
        });
        this.isLoading = false;
        this.router.navigate(['/companies']);
      },
    });

    this.subscriptions.push(companySub);

    // Also subscribe to the loading state from the service
    const loadingSub = this.companyService.loading$.subscribe((isLoading) => {
      this.isLoading = isLoading;
    });

    this.subscriptions.push(loadingSub);
  }

  /**
   * Populate form with company data
   */
  private populateForm(company: Company): void {
    // Clear existing contacts form array
    while (this.contactsFormArray.length) {
      this.contactsFormArray.removeAt(0);
    }

    // Add company contacts
    if (company.contacts && company.contacts.length > 0) {
      company.contacts.forEach((contact) => {
        this.contactsFormArray.push(
          this.fb.group({
            id: [contact.id],
            name: [contact.name, [Validators.required]],
            position: [contact.position || ''],
            email: [contact.email, [Validators.required, Validators.email]],
            phone: [contact.phone || ''],
            isPrimary: [contact.isPrimary],
          })
        );
      });
    } else {
      // Add at least one contact form
      this.contactsFormArray.push(this.createContactFormGroup(true));
    }

    // Update form values
    this.companyForm.patchValue({
      name: company.name,
      industry: company.industry,
      size: company.size,
      status: company.status,
      address: company.address,
      city: company.city || '',
      postcode: company.postcode || '',
      country: company.country || '',
      website: company.website || '',
      description: company.description || '',
      notes: company.notes || '',
    });

    // Reset changes tracking
    this.hasChanges = false;
  }

  /**
   * Get contacts form array
   */
  get contactsFormArray(): FormArray {
    return this.companyForm.get('contacts') as FormArray;
  }

  /**
   * Add a new contact form group
   */
  addContact(): void {
    this.contactsFormArray.push(this.createContactFormGroup());
  }

  /**
   * Remove a contact at specified index
   */
  removeContact(index: number): void {
    // Check if there's more than one contact
    if (this.contactsFormArray.length > 1) {
      // Check if the contact to be removed is primary
      const removedContact = this.contactsFormArray.at(index);
      const wasPrimary = removedContact.get('isPrimary')?.value;

      // Remove the contact
      this.contactsFormArray.removeAt(index);

      // If the removed contact was primary, make the first contact primary
      if (wasPrimary && this.contactsFormArray.length > 0) {
        this.contactsFormArray.at(0).get('isPrimary')?.setValue(true);
      }
    } else {
      this.snackBar.open('At least one contact is required.', 'Close', {
        duration: 3000,
      });
    }
  }

  /**
   * Set a contact as primary and update others
   */
  setPrimaryContact(index: number): void {
    // Update all contacts to non-primary
    for (let i = 0; i < this.contactsFormArray.length; i++) {
      this.contactsFormArray.at(i).get('isPrimary')?.setValue(false);
    }

    // Set selected contact as primary
    this.contactsFormArray.at(index).get('isPrimary')?.setValue(true);
  }

  /**
   * Get error message for form controls
   */
  getErrorMessage(controlName: string, formGroup?: FormGroup): string {
    const form = formGroup || this.companyForm;
    const control = form.get(controlName);

    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required';
    }

    if (control.errors['email']) {
      return 'Please enter a valid email address';
    }

    return 'Invalid value';
  }

  /**
   * Submit form
   */
  onSubmit(): void {
    if (this.companyForm.invalid) {
      this.markFormGroupTouched(this.companyForm);
      this.snackBar.open('Please correct the errors in the form.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    // Check if at least one contact is marked as primary
    const hasPrimary = this.contactsFormArray.controls.some((contact) => contact.get('isPrimary')?.value);

    if (!hasPrimary && this.contactsFormArray.length > 0) {
      // If no primary contact, set the first one as primary
      this.contactsFormArray.at(0).get('isPrimary')?.setValue(true);
    }

    this.isSubmitting = true;

    const formData = this.prepareFormData();

    if (this.isEditMode && this.companyId) {
      // Update existing company
      const updateSub = this.companyService.updateCompany(this.companyId, formData).subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Company Updated',
            message: `${formData.name} has been updated successfully`,
            actionUrl: `/companies/${this.companyId}`,
          });
          this.hasChanges = false;
          this.isSubmitting = false;
          this.router.navigate(['/companies', this.companyId]);
        },
        error: (error) => {
          console.error('Error updating company:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to update company: ${error.message}`,
          });
          this.isSubmitting = false;
        },
      });

      this.subscriptions.push(updateSub);
    } else {
      // Create new company
      const createSub = this.companyService.createCompany(formData).subscribe({
        next: (id) => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Company Created',
            message: `${formData.name} has been created successfully`,
            actionUrl: `/companies/${id}`,
          });
          this.hasChanges = false;
          this.isSubmitting = false;
          this.router.navigate(['/companies', id]);
        },
        error: (error) => {
          console.error('Error creating company:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to create company: ${error.message}`,
          });
          this.isSubmitting = false;
        },
      });

      this.subscriptions.push(createSub);
    }
  }

  /**
   * Prepare form data for submission
   */
  private prepareFormData(): Partial<Company> {
    const formValue = this.companyForm.getRawValue();

    // Process contacts to ensure they're valid
    const contacts: CompanyContact[] = formValue.contacts.map((contact: any) => ({
      id: contact.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      name: contact.name,
      position: contact.position || undefined,
      email: contact.email,
      phone: contact.phone || undefined,
      isPrimary: contact.isPrimary,
    }));

    return {
      name: formValue.name,
      industry: formValue.industry,
      size: formValue.size,
      status: formValue.status,
      address: formValue.address,
      city: formValue.city || undefined,
      postcode: formValue.postcode || undefined,
      country: formValue.country || undefined,
      website: formValue.website || undefined,
      description: formValue.description || undefined,
      contacts: contacts,
      notes: formValue.notes || undefined,
    };
  }

  /**
   * Navigate back
   */
  goBack(): void {
    if (this.hasChanges) {
      this.showUnsavedChangesDialog();
    } else {
      this.location.back();
    }
  }

  /**
   * Show dialog for unsaved changes
   */
  private showUnsavedChangesDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        confirmText: 'Leave',
        cancelText: 'Stay',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.location.back();
      }
    });
  }

  /**
   * Mark all form controls as touched to trigger validation
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((arrayControl) => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      }
    });
  }
}
