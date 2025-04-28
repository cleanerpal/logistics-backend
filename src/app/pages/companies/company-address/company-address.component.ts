import { Component, OnDestroy, OnInit, inject, Inject } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MatDialog,
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  DocumentData,
  Timestamp,
} from '@angular/fire/firestore';

// Interfaces
export interface Address {
  id: string;
  companyId: string;
  companyName: string;
  type: 'Billing' | 'Delivery' | 'Other';
  building: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
  isDefault: boolean;
  createdAt: any;
  updatedAt: any;
}

// Address Dialog Component
@Component({
  selector: 'app-address-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.isEdit ? 'Edit Address' : 'Add Address' }}</h2>
    <div mat-dialog-content>
      <form [formGroup]="addressForm">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Address Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="Billing">Billing</mat-option>
              <mat-option value="Delivery">Delivery</mat-option>
              <mat-option value="Other">Other</mat-option>
            </mat-select>
            <mat-error *ngIf="addressForm.get('type')?.hasError('required')">
              Address type is required
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Building Number/Name</mat-label>
            <input matInput formControlName="building" />
            <mat-error
              *ngIf="addressForm.get('building')?.hasError('required')"
            >
              Building number/name is required
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Street</mat-label>
            <input matInput formControlName="street" />
            <mat-error *ngIf="addressForm.get('street')?.hasError('required')">
              Street is required
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>City</mat-label>
            <input matInput formControlName="city" />
            <mat-error *ngIf="addressForm.get('city')?.hasError('required')">
              City is required
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>State/County</mat-label>
            <input matInput formControlName="state" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Postcode</mat-label>
            <input matInput formControlName="postcode" />
            <mat-error
              *ngIf="addressForm.get('postcode')?.hasError('required')"
            >
              Postcode is required
            </mat-error>
            <mat-error *ngIf="addressForm.get('postcode')?.hasError('pattern')">
              Please enter a valid UK postcode
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Country</mat-label>
            <input matInput formControlName="country" />
            <mat-error *ngIf="addressForm.get('country')?.hasError('required')">
              Country is required
            </mat-error>
          </mat-form-field>
        </div>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [mat-dialog-close]="addressForm.value"
        [disabled]="addressForm.invalid"
      >
        Save
      </button>
    </div>
  `,
  styles: [
    `
      .form-row {
        margin-bottom: 16px;
      }

      .mat-mdc-form-field {
        width: 100%;
      }
    `,
  ],
})
export class AddressDialogComponent implements OnInit {
  addressForm: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<AddressDialogComponent>
  ) {
    this.addressForm = this.formBuilder.group({
      type: ['Delivery', Validators.required],
      building: ['', Validators.required],
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: [''],
      country: ['United Kingdom', Validators.required],
      postcode: [
        '',
        [
          Validators.required,
          Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
        ],
      ],
      isDefault: [false],
    });
  }

  ngOnInit(): void {
    // If editing, populate the form
    if (this.data.isEdit && this.data.address) {
      this.addressForm.patchValue({
        type: this.data.address.type,
        building: this.data.address.building,
        street: this.data.address.street,
        city: this.data.address.city,
        state: this.data.address.state,
        country: this.data.address.country,
        postcode: this.data.address.postcode,
        isDefault: this.data.address.isDefault,
      });
    }
  }
}

@Component({
  selector: 'app-company-addresses',
  templateUrl: './company-address.component.html',
  styleUrls: ['./company-address.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatDialogModule,
  ],
})
export class CompanyAddressesComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private dialog: MatDialog = inject(MatDialog);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  companyId: string | null = null;
  companyName: string = '';
  addresses: Address[] = [];
  loading = true;

  private addressesSubscription?: Subscription;

  ngOnInit(): void {
    // Get company ID from route params
    this.route.paramMap.subscribe((params) => {
      this.companyId = params.get('id');

      if (this.companyId) {
        this.loadCompanyDetails(this.companyId);
        this.loadAddresses(this.companyId);
      } else {
        this.router.navigate(['/companies']);
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.addressesSubscription) {
      this.addressesSubscription.unsubscribe();
    }
  }

  /**
   * Load company details
   */
  async loadCompanyDetails(companyId: string): Promise<void> {
    try {
      const companyRef = doc(this.firestore, 'Companies', companyId);
      const companySnap = await getDoc(companyRef);

      if (companySnap.exists()) {
        const companyData = companySnap.data();
        this.companyName = companyData['companyName'] || 'Unknown Company';
      } else {
        this.snackBar.open('Company not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/companies']);
      }
    } catch (error) {
      console.error('Error loading company details:', error);
      this.snackBar.open('Error loading company details.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Load addresses for the company
   */
  loadAddresses(companyId: string): void {
    try {
      const addressesCollection = collection(this.firestore, 'Addresses');
      const addressesQuery = query(
        addressesCollection,
        where('companyId', '==', companyId)
      );

      this.addressesSubscription = collectionData(addressesQuery, {
        idField: 'id',
      }).subscribe({
        next: (addresses: DocumentData[]) => {
          this.addresses = addresses as Address[];
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading addresses:', error);
          this.snackBar.open('Error loading addresses.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up addresses subscription:', error);
      this.loading = false;
    }
  }

  /**
   * Open dialog to add a new address
   */
  addAddress(): void {
    if (!this.companyId) return;

    const dialogRef = this.dialog.open(AddressDialogComponent, {
      width: '500px',
      data: {
        isEdit: false,
        companyId: this.companyId,
        companyName: this.companyName,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.saveAddress(result);
      }
    });
  }

  /**
   * Open dialog to edit an existing address
   */
  editAddress(address: Address): void {
    const dialogRef = this.dialog.open(AddressDialogComponent, {
      width: '500px',
      data: {
        isEdit: true,
        address: address,
        companyId: this.companyId,
        companyName: this.companyName,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.updateAddress(address.id, result);
      }
    });
  }

  /**
   * Save a new address to Firestore
   */
  async saveAddress(addressData: any): Promise<void> {
    if (!this.companyId) return;

    try {
      const addressesCollection = collection(this.firestore, 'Addresses');

      const newAddress = {
        companyId: this.companyId,
        companyName: this.companyName,
        type: addressData.type,
        building: addressData.building,
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        postcode: addressData.postcode,
        isDefault: addressData.isDefault || false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(addressesCollection, newAddress);

      this.snackBar.open('Address added successfully.', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving address:', error);
      this.snackBar.open('Error saving address.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(addressId: string, addressData: any): Promise<void> {
    try {
      const addressRef = doc(this.firestore, 'Addresses', addressId);

      const updatedAddress = {
        type: addressData.type,
        building: addressData.building,
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        postcode: addressData.postcode,
        isDefault: addressData.isDefault || false,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(addressRef, updatedAddress);

      this.snackBar.open('Address updated successfully.', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error updating address:', error);
      this.snackBar.open('Error updating address.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this address?')) {
      try {
        const addressRef = doc(this.firestore, 'Addresses', addressId);
        await deleteDoc(addressRef);

        this.snackBar.open('Address deleted successfully.', 'Close', {
          duration: 3000,
        });
      } catch (error) {
        console.error('Error deleting address:', error);
        this.snackBar.open('Error deleting address.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      }
    }
  }

  /**
   * Set an address as default
   */
  async setAsDefault(addressId: string): Promise<void> {
    try {
      // First, set all addresses to non-default
      for (const address of this.addresses) {
        if (address.isDefault) {
          const addressRef = doc(this.firestore, 'Addresses', address.id);
          await updateDoc(addressRef, { isDefault: false });
        }
      }

      // Then set the selected address as default
      const addressRef = doc(this.firestore, 'Addresses', addressId);
      await updateDoc(addressRef, { isDefault: true });

      this.snackBar.open('Default address updated.', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error setting default address:', error);
      this.snackBar.open('Error setting default address.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Navigate back to the company list
   */
  goBack(): void {
    this.router.navigate(['/companies']);
  }

  /**
   * Format address for display
   */
  formatAddress(address: Address): string {
    return `${address.building} ${address.street}, ${address.city}, ${address.postcode}, ${address.country}`;
  }
}
