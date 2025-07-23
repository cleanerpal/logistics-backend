// src/app/pages/settings/billing-settings/billing-settings.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { BillingSettings } from '../../../interfaces/job-billing.interface';
import { JobBillingService } from '../../../services/job-billing.service';
import { EmailService } from '../../../services/email.service';

@Component({
  selector: 'app-billing-settings',
  templateUrl: './billing-settings.component.html',
  styleUrls: ['./billing-settings.component.scss'],
  standalone: false
})
export class BillingSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  settingsForm: FormGroup;
  isLoading = false;
  isSaving = false;
  isTestingEmail = false;

  constructor(
    private fb: FormBuilder,
    private jobBillingService: JobBillingService,
    private emailService: EmailService,
    private snackBar: MatSnackBar
  ) {
    this.settingsForm = this.createSettingsForm();
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createSettingsForm(): FormGroup {
    return this.fb.group({
      // Basic Settings
      vatRate: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      paymentTermsDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      invoicePrefix: ['INV-', Validators.required],
      nextInvoiceNumber: [1, [Validators.required, Validators.min(1)]],

      // Company Details
      companyDetails: this.fb.group({
        name: ['NI VEHICLE LOGISTICS LTD', Validators.required],
        address: ['55-59 Adelaide Street', Validators.required],
        city: ['Belfast', Validators.required],
        postcode: ['BT2 8FE', Validators.required],
        country: ['Northern Ireland', Validators.required],
        companyNumber: ['NI684159'],
        vatNumber: [''],
        email: ['info@nivehiclelogistics.com', [Validators.required, Validators.email]],
        phone: ['+44 28 9024 4747', Validators.required],
        website: ['https://www.nivehiclelogistics.com']
      }),

      // Bank Details
      bankDetails: this.fb.group({
        bankName: ['Example Bank', Validators.required],
        accountName: ['NI VEHICLE LOGISTICS LTD', Validators.required],
        sortCode: ['00-00-00', [Validators.required, Validators.pattern(/^\d{2}-\d{2}-\d{2}$/)]],
        accountNumber: ['12345678', [Validators.required, Validators.pattern(/^\d{8}$/)]]
      }),

      // Email Templates
      emailTemplates: this.fb.group({
        invoiceSubject: ['Invoice {{invoiceNumber}} from {{companyName}}', Validators.required],
        invoiceBody: [
          `Dear {{customerName}},

Please find attached invoice {{invoiceNumber}} for {{total}}.

Payment is due by {{dueDate}}.

Thank you for your business.

Best regards,
{{companyName}}`,
          Validators.required
        ],
        reminderSubject: ['Payment Reminder - Invoice {{invoiceNumber}}', Validators.required],
        reminderBody: [
          `Dear {{customerName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{total}} is now overdue.

Please arrange payment at your earliest convenience.

Best regards,
{{companyName}}`,
          Validators.required
        ]
      })
    });
  }

  private loadSettings(): void {
    this.isLoading = true;

    this.jobBillingService.getBillingSettings().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (settings) => {
        if (settings) {
          this.settingsForm.patchValue(settings);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading billing settings:', error);
        this.snackBar.open('Error loading settings', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.markFormGroupTouched(this.settingsForm);
      return;
    }

    this.isSaving = true;
    const settings = this.settingsForm.value as BillingSettings;

    this.jobBillingService.updateBillingSettings(settings).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.snackBar.open('Settings saved successfully', 'Close', { duration: 3000 });
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Error saving settings:', error);
        this.snackBar.open('Error saving settings', 'Close', { duration: 3000 });
        this.isSaving = false;
      }
    });
  }

  testEmailConfiguration(): void {
    this.isTestingEmail = true;

    this.emailService.testEmailConfiguration().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.snackBar.open('Email configuration test successful', 'Close', { duration: 3000 });
        this.isTestingEmail = false;
      },
      error: (error) => {
        console.error('Email test failed:', error);
        this.snackBar.open('Email configuration test failed', 'Close', { duration: 3000 });
        this.isTestingEmail = false;
      }
    });
  }

  previewInvoiceTemplate(): void {
    const settings = this.settingsForm.value as BillingSettings;
    const sampleInvoice = this.createSampleInvoice();
    
    // Open preview in new window
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    if (previewWindow) {
      previewWindow.document.write(this.generateInvoicePreviewHtml(sampleInvoice, settings));
      previewWindow.document.close();
    }
  }

  previewEmailTemplate(): void {
    const settings = this.settingsForm.value as BillingSettings;
    const sampleInvoice = this.createSampleInvoice();
    
    const subject = this.substituteTemplateVariables(
      settings.emailTemplates.invoiceSubject,
      sampleInvoice,
      settings
    );
    
    const body = this.substituteTemplateVariables(
      settings.emailTemplates.invoiceBody,
      sampleInvoice,
      settings
    );

    const previewWindow = window.open('', '_blank', 'width=600,height=400');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head><title>Email Template Preview</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Email Preview</h2>
            <div style="border: 1px solid #ccc; padding: 15px; margin-bottom: 15px;">
              <strong>Subject:</strong> ${subject}
            </div>
            <div style="border: 1px solid #ccc; padding: 15px; white-space: pre-line;">
              ${body}
            </div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  }

  resetToDefaults(): void {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      this.settingsForm.reset();
      this.settingsForm.patchValue(this.getDefaultSettings());
    }
  }

  formatSortCode(): void {
    const sortCodeControl = this.settingsForm.get('bankDetails.sortCode');
    if (sortCodeControl?.value) {
      let value = sortCodeControl.value.replace(/\D/g, '');
      if (value.length >= 6) {
        value = value.substring(0, 6);
        value = value.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
      }
      sortCodeControl.setValue(value);
    }
  }

  formatAccountNumber(): void {
    const accountNumberControl = this.settingsForm.get('bankDetails.accountNumber');
    if (accountNumberControl?.value) {
      let value = accountNumberControl.value.replace(/\D/g, '');
      if (value.length > 8) {
        value = value.substring(0, 8);
      }
      accountNumberControl.setValue(value);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched({ onlySelf: true });
      }
    });
  }

  private createSampleInvoice(): any {
    return {
      invoiceNumber: 'INV-000123',
      customerName: 'Sample Customer Ltd',
      total: 1250.00,
      subtotal: 1041.67,
      vatAmount: 208.33,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      jobId: 'JOB-001'
    };
  }

  private substituteTemplateVariables(template: string, invoice: any, settings: BillingSettings): string {
    const variables = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      total: this.formatCurrency(invoice.total),
      subtotal: this.formatCurrency(invoice.subtotal),
      vatAmount: this.formatCurrency(invoice.vatAmount),
      issueDate: invoice.issueDate.toLocaleDateString('en-GB'),
      dueDate: invoice.dueDate.toLocaleDateString('en-GB'),
      jobId: invoice.jobId,
      companyName: settings.companyDetails.name
    };

    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    });

    return result;
  }

  private generateInvoicePreviewHtml(invoice: any, settings: BillingSettings): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Preview</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .invoice-header { text-align: center; margin-bottom: 30px; }
            .company-info { text-align: right; margin-bottom: 20px; }
            .customer-info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; border: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            .total-row { font-weight: bold; background-color: #f0f0f0; }
          </style>
        </head>
        <body>
          <div class="company-info">
            <h2>${settings.companyDetails.name}</h2>
            <p>${settings.companyDetails.address}<br>
               ${settings.companyDetails.city}, ${settings.companyDetails.postcode}<br>
               ${settings.companyDetails.country}</p>
          </div>
          
          <div class="invoice-header">
            <h1>INVOICE ${invoice.invoiceNumber}</h1>
            <p>Issue Date: ${invoice.issueDate.toLocaleDateString()}</p>
            <p>Due Date: ${invoice.dueDate.toLocaleDateString()}</p>
          </div>

          <div class="customer-info">
            <h3>Bill To:</h3>
            <p><strong>${invoice.customerName}</strong></p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sample Transport Service</td>
                <td>1</td>
                <td>${this.formatCurrency(invoice.subtotal)}</td>
                <td>${this.formatCurrency(invoice.subtotal)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Subtotal</td>
                <td>${this.formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colspan="3">VAT (${settings.vatRate}%)</td>
                <td>${this.formatCurrency(invoice.vatAmount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">TOTAL</td>
                <td>${this.formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  }

  private getDefaultSettings(): Partial<BillingSettings> {
    return {
      vatRate: 20,
      paymentTermsDays: 30,
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      companyDetails: {
        name: 'NI VEHICLE LOGISTICS LTD',
        address: '55-59 Adelaide Street',
        city: 'Belfast',
        postcode: 'BT2 8FE',
        country: 'Northern Ireland',
        companyNumber: 'NI684159',
        email: 'info@nivehiclelogistics.com',
        phone: '+44 28 9024 4747',
        website: 'https://www.nivehiclelogistics.com'
      },
      bankDetails: {
        bankName: 'Example Bank',
        accountName: 'NI VEHICLE LOGISTICS LTD',
        sortCode: '00-00-00',
        accountNumber: '12345678'
      },
      emailTemplates: {
        invoiceSubject: 'Invoice {{invoiceNumber}} from {{companyName}}',
        invoiceBody: `Dear {{customerName}},

Please find attached invoice {{invoiceNumber}} for {{total}}.

Payment is due by {{dueDate}}.

Thank you for your business.

Best regards,
{{companyName}}`,
        reminderSubject: 'Payment Reminder - Invoice {{invoiceNumber}}',
        reminderBody: `Dear {{customerName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{total}} is now overdue.

Please arrange payment at your earliest convenience.

Best regards,
{{companyName}}`
      }
    };
  }
}
