// src/app/services/email.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { JobInvoice, BillingSettings } from '../interfaces/job-billing.interface';
import { environment } from '../../environments/environment';

interface EmailTemplate {
  subject: string;
  body: string;
  html?: string;
}

interface EmailRequest {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: {
    filename: string;
    content: string;
    contentType: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private readonly emailApiUrl = `${environment.apiUrl}/email`; // Your backend email endpoint

  constructor(private http: HttpClient) {}

  /**
   * Send invoice email to customer
   */
  sendInvoice(invoice: JobInvoice, settings?: BillingSettings): Observable<void> {
    if (!invoice.customerEmail) {
      return throwError(() => new Error('Customer email is required'));
    }

    const emailTemplate = this.buildInvoiceEmailTemplate(invoice, settings);
    const invoiceHtml = this.generateInvoiceHtml(invoice, settings);
    
    const emailRequest: EmailRequest = {
      to: invoice.customerEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.body,
      html: emailTemplate.html || this.generateEmailHtml(emailTemplate.body, invoiceHtml),
      attachments: [
        {
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          content: this.generateInvoicePdf(invoice, settings),
          contentType: 'application/pdf'
        }
      ]
    };

    return this.sendEmail(emailRequest);
  }

  /**
   * Send payment reminder email
   */
  sendPaymentReminder(invoice: JobInvoice, settings?: BillingSettings): Observable<void> {
    if (!invoice.customerEmail) {
      return throwError(() => new Error('Customer email is required'));
    }

    const emailTemplate = this.buildReminderEmailTemplate(invoice, settings);
    
    const emailRequest: EmailRequest = {
      to: invoice.customerEmail,
      subject: emailTemplate.subject,
      text: emailTemplate.body,
      html: emailTemplate.html || this.generateEmailHtml(emailTemplate.body)
    };

    return this.sendEmail(emailRequest);
  }

  /**
   * Send bulk reminder emails for overdue invoices
   */
  sendBulkReminders(overdueInvoices: JobInvoice[], settings?: BillingSettings): Observable<{ success: number; failed: number }> {
    const emailPromises = overdueInvoices.map(invoice => 
      this.sendPaymentReminder(invoice, settings).pipe(
        map(() => ({ success: true, invoice: invoice.invoiceNumber })),
        catchError(error => ({ success: false, invoice: invoice.invoiceNumber, error }))
      )
    );

    return new Observable(observer => {
      Promise.all(emailPromises).then(results => {
        const success = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        observer.next({ success, failed });
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Test email configuration
   */
  testEmailConfiguration(): Observable<boolean> {
    const testEmail: EmailRequest = {
      to: 'test@example.com',
      subject: 'Email Configuration Test',
      text: 'This is a test email to verify email configuration.',
      html: '<p>This is a test email to verify email configuration.</p>'
    };

    return this.sendEmail(testEmail).pipe(
      map(() => true),
      catchError(() => throwError(() => new Error('Email configuration test failed')))
    );
  }

  /**
   * Send generic email
   */
  private sendEmail(emailRequest: EmailRequest): Observable<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<void>(this.emailApiUrl, emailRequest, { headers }).pipe(
      catchError(error => {
        console.error('Email sending failed:', error);
        return throwError(() => new Error('Failed to send email'));
      })
    );
  }

  /**
   * Build invoice email template with variable substitution
   */
  private buildInvoiceEmailTemplate(invoice: JobInvoice, settings?: BillingSettings): EmailTemplate {
    const defaultSubject = 'Invoice {{invoiceNumber}} from {{companyName}}';
    const defaultBody = `Dear {{customerName}},

Please find attached invoice {{invoiceNumber}} for {{total}}.

Payment is due by {{dueDate}}.

Thank you for your business.

Best regards,
{{companyName}}`;

    const subject = settings?.emailTemplates?.invoiceSubject || defaultSubject;
    const body = settings?.emailTemplates?.invoiceBody || defaultBody;

    return {
      subject: this.substituteVariables(subject, invoice, settings),
      body: this.substituteVariables(body, invoice, settings),
      html: this.generateInvoiceEmailHtml(invoice, settings)
    };
  }

  /**
   * Build reminder email template
   */
  private buildReminderEmailTemplate(invoice: JobInvoice, settings?: BillingSettings): EmailTemplate {
    const defaultSubject = 'Payment Reminder - Invoice {{invoiceNumber}}';
    const defaultBody = `Dear {{customerName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{total}} is now overdue.

Original due date: {{dueDate}}
Days overdue: {{daysOverdue}}

Please arrange payment at your earliest convenience.

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
{{companyName}}`;

    const subject = settings?.emailTemplates?.reminderSubject || defaultSubject;
    const body = settings?.emailTemplates?.reminderBody || defaultBody;

    const daysOverdue = Math.ceil((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      subject: this.substituteVariables(subject, invoice, settings, { daysOverdue }),
      body: this.substituteVariables(body, invoice, settings, { daysOverdue })
    };
  }

  /**
   * Substitute template variables
   */
  private substituteVariables(
    template: string, 
    invoice: JobInvoice, 
    settings?: BillingSettings,
    extraVars?: { [key: string]: any }
  ): string {
    const variables = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      total: this.formatCurrency(invoice.total),
      subtotal: this.formatCurrency(invoice.subtotal),
      vatAmount: this.formatCurrency(invoice.vatAmount),
      issueDate: invoice.issueDate.toLocaleDateString('en-GB'),
      dueDate: invoice.dueDate.toLocaleDateString('en-GB'),
      jobId: invoice.jobId,
      companyName: settings?.companyDetails?.name || 'NI VEHICLE LOGISTICS LTD',
      companyAddress: settings?.companyDetails?.address || '',
      companyPhone: settings?.companyDetails?.phone || '',
      companyEmail: settings?.companyDetails?.email || '',
      ...extraVars
    };

    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    });

    return result;
  }

  /**
   * Generate HTML email template
   */
  private generateEmailHtml(textContent: string, additionalContent?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice Email</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #1976d2;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 0.9em;
            }
            .button {
              display: inline-block;
              background-color: #1976d2;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 4px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NI VEHICLE LOGISTICS LTD</h1>
          </div>
          <div class="content">
            ${textContent.split('\n').map(line => `<p>${line}</p>`).join('')}
            ${additionalContent || ''}
          </div>
          <div class="footer">
            <p>NI VEHICLE LOGISTICS LTD<br>
               55-59 Adelaide Street, Belfast, BT2 8FE<br>
               Northern Ireland<br>
               Company No: NI684159</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate invoice-specific email HTML
   */
  private generateInvoiceEmailHtml(invoice: JobInvoice, settings?: BillingSettings): string {
    const itemsHtml = invoice.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${this.formatCurrency(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${this.formatCurrency(item.amount * item.quantity)}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-top: 30px;">
        <h3>Invoice Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 12px 8px; border-bottom: 2px solid #ddd; text-align: left;">Description</th>
              <th style="padding: 12px 8px; border-bottom: 2px solid #ddd; text-align: center;">Qty</th>
              <th style="padding: 12px 8px; border-bottom: 2px solid #ddd; text-align: right;">Unit Price</th>
              <th style="padding: 12px 8px; border-bottom: 2px solid #ddd; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Subtotal:</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${this.formatCurrency(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">VAT (${invoice.vatRate}%):</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${this.formatCurrency(invoice.vatAmount)}</td>
            </tr>
            <tr style="background-color: #f0f0f0;">
              <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; font-size: 1.1em;">TOTAL:</td>
              <td style="padding: 12px 8px; text-align: right; font-weight: bold; font-size: 1.1em;">${this.formatCurrency(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  /**
   * Generate invoice HTML for attachments
   */
  private generateInvoiceHtml(invoice: JobInvoice, settings?: BillingSettings): string {
    return `
      <div style="max-width: 800px; margin: 0 auto; padding: 40px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1976d2; margin: 0;">INVOICE ${invoice.invoiceNumber}</h1>
          <p>Issue Date: ${invoice.issueDate.toLocaleDateString('en-GB')}</p>
          <p>Due Date: ${invoice.dueDate.toLocaleDateString('en-GB')}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h3>Bill To:</h3>
          <p><strong>${invoice.customerName}</strong></p>
          ${invoice.billingAddress ? `
            <p>${invoice.billingAddress.address}<br>
               ${invoice.billingAddress.city} ${invoice.billingAddress.postcode}</p>
          ` : ''}
        </div>
        
        ${this.generateInvoiceEmailHtml(invoice, settings)}
        
        <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 4px;">
          <h3>Payment Information</h3>
          <p><strong>Bank:</strong> ${settings?.bankDetails?.bankName || 'Example Bank'}<br>
             <strong>Account Name:</strong> ${settings?.bankDetails?.accountName || 'NI VEHICLE LOGISTICS LTD'}<br>
             <strong>Sort Code:</strong> ${settings?.bankDetails?.sortCode || '00-00-00'}<br>
             <strong>Account Number:</strong> ${settings?.bankDetails?.accountNumber || '12345678'}<br>
             <strong>Reference:</strong> ${invoice.invoiceNumber}</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate PDF content for invoice (placeholder)
   */
  private generateInvoicePdf(invoice: JobInvoice, settings?: BillingSettings): string {
    // In a real implementation, you would use a PDF generation library
    // like jsPDF or call a backend service to generate the PDF
    // For now, returning base64 encoded placeholder
    return btoa(this.generateInvoiceHtml(invoice, settings));
  }

  /**
   * Format currency values
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  }
}
