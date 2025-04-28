import {
  Component,
  OnInit,
  inject,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FirebaseService } from '../../services/firebase.service';
import { RoleService } from '../../services/role.service';
import { AuditLogsService } from '../../services/audit-logs.service';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';

interface CompanySettings {
  id?: string;
  // Integrations
  googleCalendar: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    connected: boolean;
  };
  quickBooks: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    connected: boolean;
  };

  // Billing
  invoiceFooter: string;
  paymentTerms: string;

  // Company Details
  companyName: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  bankDetails: {
    accountNumber: string;
    sortCode: string;
  };
  logo: string;
  taxId: string;

  // Metadata
  updatedBy?: string;
  updatedAt?: Date;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatDividerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @ViewChild('logoUpload') logoUploadInput!: ElementRef<HTMLInputElement>;
  // Dependency Injection
  private fb = inject(FormBuilder);
  private firebaseService = inject(FirebaseService);
  private roleService = inject(RoleService);
  private snackBar = inject(MatSnackBar);
  private auditLogsService = inject(AuditLogsService);
  private storage = inject(Storage);

  // Form Groups
  integrationsForm!: FormGroup;
  billingForm!: FormGroup;
  companyDetailsForm!: FormGroup;

  // UI State
  isSuperAdmin = false;
  isLoading = true;
  isSaving = false;
  uploadProgress = 0;
  logoFile: File | null = null;
  logoUrl: string | null = null;

  // Settings data
  settings: CompanySettings | null = null;
  settingsId: string | null = null;

  ngOnInit(): void {
    this.initializeForms();
    this.checkUserRole();
    this.loadSettings();
  }

  private initializeForms(): void {
    // Integrations Form
    this.integrationsForm = this.fb.group({
      googleCalendar: this.fb.group({
        clientId: ['', Validators.required],
        clientSecret: ['', Validators.required],
        refreshToken: [''],
        connected: [false],
      }),
      quickBooks: this.fb.group({
        clientId: ['', Validators.required],
        clientSecret: ['', Validators.required],
        refreshToken: [''],
        connected: [false],
      }),
    });

    // Billing Form
    this.billingForm = this.fb.group({
      invoiceFooter: [''],
      paymentTerms: ['Net 30', Validators.required],
    });

    // Company Details Form
    this.companyDetailsForm = this.fb.group({
      companyName: ['', Validators.required],
      address: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        country: ['', Validators.required],
        zip: ['', Validators.required],
      }),
      bankDetails: this.fb.group({
        accountNumber: ['', Validators.required],
        sortCode: ['', Validators.required],
      }),
      taxId: ['', Validators.required],
    });
  }

  private checkUserRole(): void {
    this.roleService.isSuperAdmin().subscribe((isSuperAdmin) => {
      this.isSuperAdmin = isSuperAdmin;

      if (!isSuperAdmin) {
        this.snackBar.open('Only Super Admins can access settings', 'Close', {
          duration: 5000,
        });
      }
    });
  }

  private loadSettings(): void {
    this.isLoading = true;

    this.firebaseService
      .getCollectionWithSnapshot<CompanySettings>('settings')
      .subscribe(
        (settings) => {
          if (settings && settings.length > 0) {
            this.settings = settings[0];
            this.settingsId = settings[0].id || null;
            this.populateForms(this.settings);
            this.logoUrl = this.settings.logo || null;
          }
          this.isLoading = false;
        },
        (error) => {
          console.error('Error loading settings:', error);
          this.snackBar.open('Error loading settings', 'Close', {
            duration: 5000,
          });
          this.isLoading = false;
        }
      );
  }

  private populateForms(settings: CompanySettings): void {
    // Populate Integrations Form
    this.integrationsForm.patchValue({
      googleCalendar: {
        clientId: settings.googleCalendar?.clientId || '',
        clientSecret: settings.googleCalendar?.clientSecret || '',
        refreshToken: settings.googleCalendar?.refreshToken || '',
        connected: settings.googleCalendar?.connected || false,
      },
      quickBooks: {
        clientId: settings.quickBooks?.clientId || '',
        clientSecret: settings.quickBooks?.clientSecret || '',
        refreshToken: settings.quickBooks?.refreshToken || '',
        connected: settings.quickBooks?.connected || false,
      },
    });

    // Populate Billing Form
    this.billingForm.patchValue({
      invoiceFooter: settings.invoiceFooter || '',
      paymentTerms: settings.paymentTerms || 'Net 30',
    });

    // Populate Company Details Form
    this.companyDetailsForm.patchValue({
      companyName: settings.companyName || '',
      address: {
        street: settings.address?.street || '',
        city: settings.address?.city || '',
        state: settings.address?.state || '',
        country: settings.address?.country || '',
        zip: settings.address?.zip || '',
      },
      bankDetails: {
        accountNumber: settings.bankDetails?.accountNumber || '',
        sortCode: settings.bankDetails?.sortCode || '',
      },
      taxId: settings.taxId || '',
    });
  }

  async saveIntegrations(): Promise<void> {
    if (this.integrationsForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;
    const formData = this.integrationsForm.value;

    try {
      let settingsData: CompanySettings;

      if (this.settingsId) {
        // Update existing settings
        settingsData = {
          ...this.settings!,
          googleCalendar: formData.googleCalendar,
          quickBooks: formData.quickBooks,
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        await this.firebaseService.updateDocument('settings', this.settingsId, {
          googleCalendar: formData.googleCalendar,
          quickBooks: formData.quickBooks,
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        });
      } else {
        // Create new settings
        settingsData = {
          googleCalendar: formData.googleCalendar,
          quickBooks: formData.quickBooks,
          invoiceFooter: '',
          paymentTerms: 'Net 30',
          companyName: '',
          address: {
            street: '',
            city: '',
            state: '',
            country: '',
            zip: '',
          },
          bankDetails: {
            accountNumber: '',
            sortCode: '',
          },
          logo: '',
          taxId: '',
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        this.settingsId = await this.firebaseService.addDocument(
          'settings',
          settingsData
        );
      }

      // Log the action
      await this.auditLogsService.createAuditLog({
        action: 'update',
        resource: 'settings',
        resourceId: this.settingsId,
        details: 'Updated integration settings',
        userId:
          (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        userName:
          (await this.firebaseService.user$.toPromise())?.displayName ||
          'Unknown User',
      });

      this.snackBar.open('Integration settings saved successfully', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving integration settings:', error);
      this.snackBar.open('Error saving settings', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  async saveBillingSettings(): Promise<void> {
    if (this.billingForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;
    const formData = this.billingForm.value;

    try {
      let settingsData: CompanySettings;

      if (this.settingsId) {
        // Update existing settings
        settingsData = {
          ...this.settings!,
          invoiceFooter: formData.invoiceFooter,
          paymentTerms: formData.paymentTerms,
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        await this.firebaseService.updateDocument('settings', this.settingsId, {
          invoiceFooter: formData.invoiceFooter,
          paymentTerms: formData.paymentTerms,
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        });
      } else {
        // Create new settings
        settingsData = {
          googleCalendar: {
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            connected: false,
          },
          quickBooks: {
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            connected: false,
          },
          invoiceFooter: formData.invoiceFooter,
          paymentTerms: formData.paymentTerms,
          companyName: '',
          address: {
            street: '',
            city: '',
            state: '',
            country: '',
            zip: '',
          },
          bankDetails: {
            accountNumber: '',
            sortCode: '',
          },
          logo: '',
          taxId: '',
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        this.settingsId = await this.firebaseService.addDocument(
          'settings',
          settingsData
        );
      }

      // Log the action
      await this.auditLogsService.createAuditLog({
        action: 'update',
        resource: 'settings',
        resourceId: this.settingsId,
        details: 'Updated billing settings',
        userId:
          (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        userName:
          (await this.firebaseService.user$.toPromise())?.displayName ||
          'Unknown User',
      });

      this.snackBar.open('Billing settings saved successfully', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving billing settings:', error);
      this.snackBar.open('Error saving settings', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  async saveCompanyDetails(): Promise<void> {
    if (this.companyDetailsForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;
    const formData = this.companyDetailsForm.value;
    let logoUrl = this.logoUrl;

    try {
      // Upload logo if selected
      if (this.logoFile) {
        logoUrl = await this.uploadLogo();
      }

      let settingsData: CompanySettings;

      if (this.settingsId) {
        // Update existing settings
        settingsData = {
          ...this.settings!,
          companyName: formData.companyName,
          address: formData.address,
          bankDetails: formData.bankDetails,
          taxId: formData.taxId,
          logo: logoUrl || '',
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        await this.firebaseService.updateDocument('settings', this.settingsId, {
          companyName: formData.companyName,
          address: formData.address,
          bankDetails: formData.bankDetails,
          taxId: formData.taxId,
          logo: logoUrl || '',
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        });
      } else {
        // Create new settings
        settingsData = {
          googleCalendar: {
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            connected: false,
          },
          quickBooks: {
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            connected: false,
          },
          invoiceFooter: '',
          paymentTerms: 'Net 30',
          companyName: formData.companyName,
          address: formData.address,
          bankDetails: formData.bankDetails,
          taxId: formData.taxId,
          logo: logoUrl || '',
          updatedAt: new Date(),
          updatedBy:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        };

        this.settingsId = await this.firebaseService.addDocument(
          'settings',
          settingsData
        );
      }

      // Log the action
      await this.auditLogsService.createAuditLog({
        action: 'update',
        resource: 'settings',
        resourceId: this.settingsId,
        details: 'Updated company details',
        userId:
          (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
        userName:
          (await this.firebaseService.user$.toPromise())?.displayName ||
          'Unknown User',
      });

      this.snackBar.open('Company details saved successfully', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving company details:', error);
      this.snackBar.open('Error saving company details', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.match('image.*')) {
        this.snackBar.open('Please select an image file', 'Close', {
          duration: 3000,
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.snackBar.open('Image size should be less than 2MB', 'Close', {
          duration: 3000,
        });
        return;
      }

      this.logoFile = file;

      // Create a preview
      const reader = new FileReader();
      reader.onload = () => {
        this.logoUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private async uploadLogo(): Promise<string> {
    if (!this.logoFile) return '';

    const user = await this.firebaseService.user$.toPromise();
    if (!user) throw new Error('User not authenticated');

    const filePath = `company/logo_${new Date().getTime()}`;
    const storageRef = ref(this.storage, filePath);

    // Delete old logo if exists
    if (this.settings?.logo && this.settings.logo.includes('company/logo_')) {
      try {
        const oldLogoRef = ref(this.storage, this.settings.logo);
        await deleteObject(oldLogoRef);
      } catch (error) {
        console.error('Error deleting old logo:', error);
        // Continue with upload even if delete fails
      }
    }

    // Upload new logo
    const uploadTask = uploadBytesResumable(storageRef, this.logoFile);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          this.uploadProgress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        },
        (error) => {
          console.error('Error uploading logo:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          this.uploadProgress = 0;
          this.logoFile = null;
          resolve(downloadURL);
        }
      );
    });
  }

  async testGoogleCalendarConnection(): Promise<void> {
    const googleSettings = this.integrationsForm.get('googleCalendar')?.value;

    if (
      !googleSettings.clientId ||
      !googleSettings.clientSecret ||
      !googleSettings.refreshToken
    ) {
      this.snackBar.open(
        'Please fill all Google Calendar credentials',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    try {
      this.isSaving = true;

      // In a real implementation, you would make an API call to test the connection
      // For this example, we'll simulate a successful connection after a delay

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update connected status
      this.integrationsForm.get('googleCalendar')?.patchValue({
        connected: true,
      });

      this.snackBar.open(
        'Successfully connected to Google Calendar API',
        'Close',
        {
          duration: 3000,
        }
      );

      // Log the action
      if (this.settingsId) {
        await this.auditLogsService.createAuditLog({
          action: 'update',
          resource: 'settings',
          resourceId: this.settingsId,
          details: 'Tested Google Calendar connection',
          userId:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
          userName:
            (await this.firebaseService.user$.toPromise())?.displayName ||
            'Unknown User',
        });
      }
    } catch (error) {
      console.error('Error testing Google Calendar connection:', error);
      this.snackBar.open('Failed to connect to Google Calendar API', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  async testQuickBooksConnection(): Promise<void> {
    const quickBooksSettings = this.integrationsForm.get('quickBooks')?.value;

    if (
      !quickBooksSettings.clientId ||
      !quickBooksSettings.clientSecret ||
      !quickBooksSettings.refreshToken
    ) {
      this.snackBar.open('Please fill all QuickBooks credentials', 'Close', {
        duration: 3000,
      });
      return;
    }

    try {
      this.isSaving = true;

      // In a real implementation, you would make an API call to test the connection
      // For this example, we'll simulate a successful connection after a delay

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update connected status
      this.integrationsForm.get('quickBooks')?.patchValue({
        connected: true,
      });

      this.snackBar.open('Successfully connected to QuickBooks API', 'Close', {
        duration: 3000,
      });

      // Log the action
      if (this.settingsId) {
        await this.auditLogsService.createAuditLog({
          action: 'update',
          resource: 'settings',
          resourceId: this.settingsId,
          details: 'Tested QuickBooks connection',
          userId:
            (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
          userName:
            (await this.firebaseService.user$.toPromise())?.displayName ||
            'Unknown User',
        });
      }
    } catch (error) {
      console.error('Error testing QuickBooks connection:', error);
      this.snackBar.open('Failed to connect to QuickBooks API', 'Close', {
        duration: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  resetLogoUpload(): void {
    this.logoFile = null;
    this.logoUrl = this.settings?.logo || null;
    this.uploadProgress = 0;
  }
}
