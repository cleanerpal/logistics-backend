import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerService } from '../../../services/customer.service';
import { NotificationService } from '../../../services/notification.service';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Customer, CustomerStatus, CustomerContact } from '../../../interfaces/customer.interface';

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
  isLookingUpPostcode = false;
  hasChanges = false;

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
      status: [CustomerStatus.ACTIVE, [Validators.required]],
      address: this.fb.group({
        street: ['', [Validators.required]],
        street2: [''],
        city: ['', [Validators.required]],
        county: [''],
        postcode: ['', [Validators.required]],
        country: ['United Kingdom'],
      }),
      primaryContact: this.fb.group({
        name: [''],
        email: ['', [Validators.email]],
        phone: [''],
      }),
    });
  }

  async lookupPostcode(): Promise<void> {
    const postcode = this.customerForm.get('address.postcode')?.value;
    if (!postcode) {
      this.snackBar.open('Please enter a postcode first', 'Close', { duration: 3000 });
      return;
    }

    this.isLookingUpPostcode = true;

    try {
      // For now, we'll use a simple UK postcode API
      // You can replace this with Google Places API or other preferred service
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);

      if (response.ok) {
        const data = await response.json();

        if (data.status === 200 && data.result) {
          const result = data.result;

          // Auto-fill the address fields
          this.customerForm.patchValue({
            address: {
              city: result.admin_district || result.admin_county || '',
              county: result.admin_county || '',
              country: result.country || 'United Kingdom',
            },
          });

          this.notificationService.addNotification({
            type: 'success',
            title: 'Postcode Found',
            message: `Address details updated for ${postcode}`,
          });
        } else {
          this.showPostcodeError('Postcode not found. Please check and try again.');
        }
      } else {
        this.showPostcodeError('Unable to lookup postcode. Please enter address manually.');
      }
    } catch (error) {
      console.error('Postcode lookup error:', error);
      this.showPostcodeError('Postcode lookup service unavailable. Please enter address manually.');
    } finally {
      this.isLookingUpPostcode = false;
    }
  }

  private showPostcodeError(message: string): void {
    this.notificationService.addNotification({
      type: 'warning',
      title: 'Postcode Lookup',
      message,
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
    // Find the primary contact or use the first contact if available
    let primaryContact = null;
    if (customer.contacts && customer.contacts.length > 0) {
      primaryContact = customer.contacts.find((contact) => contact.isPrimary) || customer.contacts[0];
    }

    // Parse the existing address if it's a string, or use the structured address
    let addressData = {
      street: '',
      street2: '',
      city: '',
      county: '',
      postcode: '',
      country: 'United Kingdom',
    };

    if (customer.address) {
      if (typeof customer.address === 'string') {
        // If address is a string, put it in the street field
        addressData.street = customer.address;
      } else if (typeof customer.address === 'object') {
        // If address is already structured, use it with proper type assertion
        const structuredAddress = customer.address as any;
        addressData = {
          street: structuredAddress.street || '',
          street2: structuredAddress.street2 || '',
          city: structuredAddress.city || '',
          county: structuredAddress.county || '',
          postcode: structuredAddress.postcode || '',
          country: structuredAddress.country || 'United Kingdom',
        };
      }
    }

    this.customerForm.patchValue({
      name: customer.name,
      status: customer.status,
      address: addressData,
      primaryContact: {
        name: primaryContact?.name || '',
        email: primaryContact?.email || '',
        phone: primaryContact?.phone || '',
      },
    });

    this.hasChanges = false;
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

    // Create a formatted address string from the structured data
    const addressParts = [
      formValue.address.street,
      formValue.address.street2,
      formValue.address.city,
      formValue.address.county,
      formValue.address.postcode,
      formValue.address.country,
    ].filter((part) => part && part.trim() !== '');

    const formattedAddress = addressParts.join(', ');

    // Create the primary contact only if at least one field is provided
    const contacts: CustomerContact[] = [];
    const contactData = formValue.primaryContact;

    if (contactData.name || contactData.email || contactData.phone) {
      const primaryContact: CustomerContact = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        isPrimary: true,
      };
      contacts.push(primaryContact);
    }

    return {
      name: formValue.name,
      status: formValue.status,
      address: formattedAddress, // Store as formatted string for compatibility
      // Also store structured address data if your interface supports it
      // addressStructured: formValue.address,
      contacts: contacts,
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
      }
    });
  }
}
