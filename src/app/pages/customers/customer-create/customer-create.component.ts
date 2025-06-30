import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerService } from '../../../services/customer.service';
import { NotificationService } from '../../../services/notification.service';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Customer, CustomerSize, CustomerStatus, CustomerContact } from '../../../interfaces/customer.interface';

@Component({
  selector: 'app-customer-create',
  templateUrl: './customer-create.component.html',
  styleUrls: ['./customer-create.component.scss'],
  standalone: false,
})
export class CustomerCreateComponent implements OnInit, OnDestroy {
  customerForm!: FormGroup;
  customerId: string | null = null;
  isEditMode = false;
  isSubmitting = false;
  isLoading = false;
  hasChanges = false;

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

  customerSizes = [CustomerSize.SMALL, CustomerSize.MEDIUM, CustomerSize.LARGE, CustomerSize.ENTERPRISE];

  customerStatuses = [CustomerStatus.ACTIVE, CustomerStatus.INACTIVE, CustomerStatus.PENDING];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
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
    this.customerId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.customerId;

    if (this.isEditMode && this.customerId) {
      this.loadCustomerData(this.customerId);
    }

    const formChangeSub = this.customerForm.valueChanges.subscribe(() => {
      this.hasChanges = true;
    });
    this.subscriptions.push(formChangeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForm(): void {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required]],
      industry: ['', [Validators.required]],
      size: [CustomerSize.SMALL, [Validators.required]],
      status: [CustomerStatus.ACTIVE, [Validators.required]],
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

  private loadCustomerData(customerId: string): void {
    this.isLoading = true;

    const customerSub = this.customerService.getCustomerById(customerId).subscribe({
      next: (customer) => {
        if (customer) {
          this.populateForm(customer);
        } else {
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Customer not found',
          });
          this.router.navigate(['/customers']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading customer:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load customer data',
        });
        this.isLoading = false;
        this.router.navigate(['/customers']);
      },
    });

    this.subscriptions.push(customerSub);

    const loadingSub = this.customerService.loading$.subscribe((isLoading) => {
      this.isLoading = isLoading;
    });

    this.subscriptions.push(loadingSub);
  }

  private populateForm(customer: Customer): void {
    while (this.contactsFormArray.length) {
      this.contactsFormArray.removeAt(0);
    }

    if (customer.contacts && customer.contacts.length > 0) {
      customer.contacts.forEach((contact) => {
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
      this.contactsFormArray.push(this.createContactFormGroup(true));
    }

    this.customerForm.patchValue({
      name: customer.name,
      industry: customer.industry,
      size: customer.size,
      status: customer.status,
      address: customer.address,
      city: customer.city || '',
      postcode: customer.postcode || '',
      country: customer.country || '',
      website: customer.website || '',
      description: customer.description || '',
      notes: customer.notes || '',
    });

    this.hasChanges = false;
  }

  get contactsFormArray(): FormArray {
    return this.customerForm.get('contacts') as FormArray;
  }

  addContact(): void {
    this.contactsFormArray.push(this.createContactFormGroup());
  }

  removeContact(index: number): void {
    if (this.contactsFormArray.length > 1) {
      const removedContact = this.contactsFormArray.at(index);
      const wasPrimary = removedContact.get('isPrimary')?.value;

      this.contactsFormArray.removeAt(index);

      if (wasPrimary && this.contactsFormArray.length > 0) {
        this.contactsFormArray.at(0).get('isPrimary')?.setValue(true);
      }
    } else {
      this.snackBar.open('At least one contact is required.', 'Close', {
        duration: 3000,
      });
    }
  }

  setPrimaryContact(index: number): void {
    for (let i = 0; i < this.contactsFormArray.length; i++) {
      this.contactsFormArray.at(i).get('isPrimary')?.setValue(false);
    }

    this.contactsFormArray.at(index).get('isPrimary')?.setValue(true);
  }

  getErrorMessage(controlName: string, formGroup?: FormGroup): string {
    const form = formGroup || this.customerForm;
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

  onSubmit(): void {
    if (this.customerForm.invalid) {
      this.markFormGroupTouched(this.customerForm);
      this.snackBar.open('Please correct the errors in the form.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    const hasPrimary = this.contactsFormArray.controls.some((contact) => contact.get('isPrimary')?.value);

    if (!hasPrimary && this.contactsFormArray.length > 0) {
      this.contactsFormArray.at(0).get('isPrimary')?.setValue(true);
    }

    this.isSubmitting = true;

    const formData = this.prepareFormData();

    if (this.isEditMode && this.customerId) {
      const updateSub = this.customerService.updateCustomer(this.customerId, formData).subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Customer Updated',
            message: `${formData.name} has been updated successfully`,
            actionUrl: `/customers/${this.customerId}`,
          });
          this.hasChanges = false;
          this.isSubmitting = false;
          this.router.navigate(['/customers', this.customerId]);
        },
        error: (error) => {
          console.error('Error updating customer:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to update customer: ${error.message}`,
          });
          this.isSubmitting = false;
        },
      });

      this.subscriptions.push(updateSub);
    } else {
      const createSub = this.customerService.createCustomer(formData).subscribe({
        next: (id) => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Customer Created',
            message: `${formData.name} has been created successfully`,
            actionUrl: `/customers/${id}`,
          });
          this.hasChanges = false;
          this.isSubmitting = false;
          this.router.navigate(['/customers', id]);
        },
        error: (error) => {
          console.error('Error creating customer:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to create customer: ${error.message}`,
          });
          this.isSubmitting = false;
        },
      });

      this.subscriptions.push(createSub);
    }
  }

  private prepareFormData(): Partial<Customer> {
    const formValue = this.customerForm.getRawValue();

    const contacts: CustomerContact[] = formValue.contacts.map((contact: any) => ({
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

  goBack(): void {
    if (this.hasChanges) {
      this.showUnsavedChangesDialog();
    } else {
      this.location.back();
    }
  }

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
