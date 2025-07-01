// src/app/services/pdf-report.service.ts - Fixed TypeScript issues
import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Job, JobProcessStepData, JobNote } from '../interfaces/job-new.interface';
import { JobProcessData, ProcessPhoto, ProcessSignature } from './job-process.service';
import { StorageService } from './storage.service';

export interface PDFReportOptions {
  includePhotos: boolean;
  includeSignatures: boolean;
  includeChecklists: boolean;
  includeDamageReport: boolean;
  includeNotes: boolean;
  reportType: 'POC' | 'POD' | 'COMBINED';
}

export interface GeneratedReport {
  id: string;
  fileName: string;
  downloadUrl: string;
  type: 'POC' | 'POD' | 'COMBINED';
  generatedAt: Date;
  fileSize: number;
}

@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  constructor(private storageService: StorageService) {}

  /**
   * Generate comprehensive POD/POC report
   */
  generateJobReport(
    job: Job,
    processData: JobProcessData,
    options: PDFReportOptions = {
      includePhotos: true,
      includeSignatures: true,
      includeChecklists: true,
      includeDamageReport: true,
      includeNotes: true,
      reportType: 'COMBINED',
    }
  ): Observable<GeneratedReport> {
    return from(this.createPDFReport(job, processData, options)).pipe(
      switchMap((pdfBlob) => this.uploadReportToStorage(job.id, pdfBlob, options.reportType)),
      map((uploadResult) => ({
        id: `report_${job.id}_${Date.now()}`,
        fileName: uploadResult.fileName,
        downloadUrl: uploadResult.downloadUrl,
        type: options.reportType,
        generatedAt: new Date(),
        fileSize: uploadResult.fileSize,
      }))
    );
  }

  /**
   * Create the PDF document
   */
  private async createPDFReport(job: Job, processData: JobProcessData, options: PDFReportOptions): Promise<Blob> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Add header
    yPosition = await this.addReportHeader(pdf, job, options.reportType, yPosition, pageWidth);

    // Add job summary
    yPosition = this.addJobSummary(pdf, job, yPosition, pageWidth, margin);

    // Add vehicle information
    yPosition = this.addVehicleInformation(pdf, job, yPosition, pageWidth, margin);

    // Add collection information if POC or COMBINED
    if (options.reportType === 'POC' || options.reportType === 'COMBINED') {
      yPosition = await this.addCollectionSection(pdf, job, processData, options, yPosition, pageWidth, margin, pageHeight);
    }

    // Add delivery information if POD or COMBINED
    if (options.reportType === 'POD' || options.reportType === 'COMBINED') {
      yPosition = await this.addDeliverySection(pdf, job, processData, options, yPosition, pageWidth, margin, pageHeight);
    }

    // Add damage reports
    if (options.includeDamageReport && this.hasDamageReports(processData)) {
      yPosition = this.addDamageReports(pdf, job, processData, yPosition, pageWidth, margin, pageHeight);
    }

    // Add notes section
    if (options.includeNotes) {
      yPosition = this.addNotesSection(pdf, job, processData, yPosition, pageWidth, margin, pageHeight);
    }

    // Add footer
    this.addReportFooter(pdf, job, pageHeight);

    return pdf.output('blob');
  }

  /**
   * Add report header with company branding
   */
  private async addReportHeader(pdf: jsPDF, job: Job, reportType: string, yPosition: number, pageWidth: number): Promise<number> {
    const margin = 20;

    // Add company logo area (placeholder)
    pdf.setFillColor(59, 130, 246);
    pdf.rect(margin, yPosition, 40, 15, 'F');

    // Company name
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('CleanerPal', margin + 2, yPosition + 10);

    // Report title
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const title = this.getReportTitle(reportType);
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, pageWidth - margin - titleWidth, yPosition + 15);

    // Job ID and date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const jobInfo = `Job ID: ${job.id.substring(0, 8)}... | Generated: ${new Date().toLocaleDateString('en-GB')}`;
    const jobInfoWidth = pdf.getTextWidth(jobInfo);
    pdf.text(jobInfo, pageWidth - margin - jobInfoWidth, yPosition + 25);

    // Separator line
    yPosition += 35;
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);

    return yPosition + 10;
  }

  /**
   * Add job summary section
   */
  private addJobSummary(pdf: jsPDF, job: Job, yPosition: number, pageWidth: number, margin: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Job Summary', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const summaryData = [
      ['Customer:', job.customerName || 'Not specified'],
      ['Job Type:', job.isSplitJourney ? 'Split Journey' : 'Standard Delivery'],
      ['Status:', job.status?.toUpperCase() || 'UNKNOWN'],
      ['Created:', job.createdAt ? this.formatTimestamp(job.createdAt) : 'N/A'],
      ['Created By:', job.createdBy || 'System'],
    ];

    if (job.shippingReference) {
      summaryData.push(['Shipping Ref:', job.shippingReference]);
    }

    summaryData.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + 40, yPosition);
      yPosition += 6;
    });

    return yPosition + 10;
  }

  /**
   * Add vehicle information section
   */
  private addVehicleInformation(pdf: jsPDF, job: Job, yPosition: number, pageWidth: number, margin: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Vehicle Information', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const vehicleData = [
      ['Registration:', job.vehicleRegistration || 'Not specified'],
      ['Make:', job.vehicleMake || 'Not specified'],
      ['Model:', job.vehicleModel || 'Not specified'],
      ['Year:', job.vehicleYear?.toString() || 'Not specified'],
      ['Color:', job.vehicleColor || 'Not specified'],
    ];

    if (job.chassisNumber) {
      vehicleData.push(['Chassis:', job.chassisNumber]);
    }

    vehicleData.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + 40, yPosition);
      yPosition += 6;
    });

    return yPosition + 10;
  }

  /**
   * Add collection section
   */
  private async addCollectionSection(
    pdf: jsPDF,
    job: Job,
    processData: JobProcessData,
    options: PDFReportOptions,
    yPosition: number,
    pageWidth: number,
    margin: number,
    pageHeight: number
  ): Promise<number> {
    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('COLLECTION DETAILS', margin, yPosition);
    yPosition += 15;

    // Collection address and contact
    yPosition = this.addAddressSection(
      pdf,
      'Collection Address',
      {
        address: job.collectionAddress,
        city: job.collectionCity,
        postcode: job.collectionPostcode,
        contactName: job.collectionContactName,
        contactPhone: job.collectionContactPhone,
        contactEmail: job.collectionContactEmail,
      },
      yPosition,
      margin
    );

    // Collection times
    if (job.collectionActualStartTime || job.collectionActualCompleteTime) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Collection Times', margin, yPosition);
      yPosition += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);

      if (job.collectionActualStartTime) {
        pdf.text(`Started: ${this.formatTimestamp(job.collectionActualStartTime)}`, margin, yPosition);
        yPosition += 6;
      }

      if (job.collectionActualCompleteTime) {
        pdf.text(`Completed: ${this.formatTimestamp(job.collectionActualCompleteTime)}`, margin, yPosition);
        yPosition += 6;
      }
      yPosition += 5;
    }

    // Collection process data
    if (processData.collection) {
      yPosition = this.addProcessData(pdf, 'Collection Process Data', processData.collection as JobProcessStepData, yPosition, margin);
    }

    // Collection photos
    if (options.includePhotos && processData.documents.collectionPhotos.length > 0) {
      yPosition = await this.addPhotosSection(pdf, 'Collection Photos', processData.documents.collectionPhotos, yPosition, pageWidth, margin, pageHeight);
    }

    // Collection signature
    if (options.includeSignatures && processData.documents.collectionSignature) {
      yPosition = await this.addSignatureSection(pdf, 'Collection Signature', processData.documents.collectionSignature, yPosition, pageWidth, margin, pageHeight);
    }

    // Collection notes
    if (job.collectionNotes) {
      yPosition = this.addNotesSubSection(pdf, 'Collection Instructions', job.collectionNotes, yPosition, pageWidth, margin, pageHeight);
    }

    if (processData.collection?.notes) {
      yPosition = this.addNotesSubSection(pdf, 'Collection Process Notes', processData.collection.notes, yPosition, pageWidth, margin, pageHeight);
    }

    return yPosition + 10;
  }

  /**
   * Add delivery section
   */
  private async addDeliverySection(
    pdf: jsPDF,
    job: Job,
    processData: JobProcessData,
    options: PDFReportOptions,
    yPosition: number,
    pageWidth: number,
    margin: number,
    pageHeight: number
  ): Promise<number> {
    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('DELIVERY DETAILS', margin, yPosition);
    yPosition += 15;

    // Delivery address and contact
    yPosition = this.addAddressSection(
      pdf,
      'Delivery Address',
      {
        address: job.deliveryAddress,
        city: job.deliveryCity,
        postcode: job.deliveryPostcode,
        contactName: job.deliveryContactName,
        contactPhone: job.deliveryContactPhone,
        contactEmail: job.deliveryContactEmail,
      },
      yPosition,
      margin
    );

    // Delivery times
    if (job.deliveryActualStartTime || job.deliveryActualCompleteTime) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Delivery Times', margin, yPosition);
      yPosition += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);

      if (job.deliveryActualStartTime) {
        pdf.text(`Started: ${this.formatTimestamp(job.deliveryActualStartTime)}`, margin, yPosition);
        yPosition += 6;
      }

      if (job.deliveryActualCompleteTime) {
        pdf.text(`Completed: ${this.formatTimestamp(job.deliveryActualCompleteTime)}`, margin, yPosition);
        yPosition += 6;
      }
      yPosition += 5;
    }

    // Delivery process data
    if (processData.delivery) {
      yPosition = this.addProcessData(pdf, 'Delivery Process Data', processData.delivery as JobProcessStepData, yPosition, margin);
    }

    // Delivery photos
    if (options.includePhotos && processData.documents.deliveryPhotos.length > 0) {
      yPosition = await this.addPhotosSection(pdf, 'Delivery Photos', processData.documents.deliveryPhotos, yPosition, pageWidth, margin, pageHeight);
    }

    // Delivery signature
    if (options.includeSignatures && processData.documents.deliverySignature) {
      yPosition = await this.addSignatureSection(pdf, 'Delivery Signature', processData.documents.deliverySignature, yPosition, pageWidth, margin, pageHeight);
    }

    // Delivery notes
    if (job.deliveryNotes) {
      yPosition = this.addNotesSubSection(pdf, 'Delivery Instructions', job.deliveryNotes, yPosition, pageWidth, margin, pageHeight);
    }

    if (processData.delivery?.notes) {
      yPosition = this.addNotesSubSection(pdf, 'Delivery Process Notes', processData.delivery.notes, yPosition, pageWidth, margin, pageHeight);
    }

    return yPosition + 10;
  }

  /**
   * Add address section helper
   */
  private addAddressSection(pdf: jsPDF, title: string, addressData: any, yPosition: number, margin: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    if (addressData.address) {
      pdf.text(addressData.address, margin, yPosition);
      yPosition += 6;
    }

    if (addressData.city || addressData.postcode) {
      const cityPostcode = [addressData.city, addressData.postcode].filter(Boolean).join(' ');
      pdf.text(cityPostcode, margin, yPosition);
      yPosition += 6;
    }

    if (addressData.contactName) {
      pdf.text(`Contact: ${addressData.contactName}`, margin, yPosition);
      yPosition += 6;
    }

    if (addressData.contactPhone) {
      pdf.text(`Phone: ${addressData.contactPhone}`, margin, yPosition);
      yPosition += 6;
    }

    if (addressData.contactEmail) {
      pdf.text(`Email: ${addressData.contactEmail}`, margin, yPosition);
      yPosition += 6;
    }

    return yPosition + 5;
  }

  /**
   * Add process data section
   */
  private addProcessData(pdf: jsPDF, title: string, processData: JobProcessStepData, yPosition: number, margin: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const processItems = [];

    if (processData.mileage !== undefined) {
      processItems.push(['Mileage:', `${processData.mileage} miles`]);
    }

    if (processData.fuelLevel !== undefined) {
      const energyLabel = processData.energyType?.toLowerCase() === 'electric' ? 'Charge' : 'Fuel';
      processItems.push([`${energyLabel} Level:`, `${processData.fuelLevel}%`]);
    }

    if (processData.energyType) {
      processItems.push(['Energy Type:', processData.energyType.charAt(0).toUpperCase() + processData.energyType.slice(1)]);
    }

    if (processData.contactName) {
      processItems.push(['Contact:', processData.contactName]);
    }

    if (processData.contactPosition) {
      processItems.push(['Position:', processData.contactPosition]);
    }

    if (processData.contactNumber) {
      processItems.push(['Phone:', processData.contactNumber]);
    }

    if (processData.contactEmail) {
      processItems.push(['Email:', processData.contactEmail]);
    }

    if (processData.damageReportedThisStep !== undefined) {
      processItems.push(['Damage Reported:', processData.damageReportedThisStep ? 'YES' : 'No']);
    }

    processItems.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + 40, yPosition);
      yPosition += 6;
    });

    // Add checklist items if present
    if (processData.checklistItems && processData.checklistItems.length > 0) {
      yPosition += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Vehicle Checklist:', margin, yPosition);
      yPosition += 6;

      pdf.setFont('helvetica', 'normal');
      processData.checklistItems.forEach((item) => {
        const status = item.isChecked ? '✓' : '✗';
        const statusColor = item.isChecked ? [0, 150, 0] : [200, 0, 0];

        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(status, margin + 5, yPosition);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${item.name}`, margin + 15, yPosition);

        if (item.notes) {
          pdf.text(`(${item.notes})`, margin + 80, yPosition);
        }
        yPosition += 6;
      });
    }

    return yPosition + 10;
  }

  /**
   * Add photos section
   */
  private async addPhotosSection(
    pdf: jsPDF,
    title: string,
    photos: ProcessPhoto[],
    yPosition: number,
    pageWidth: number,
    margin: number,
    pageHeight: number
  ): Promise<number> {
    if (photos.length === 0) return yPosition;

    // Check if we need a new page
    if (yPosition > pageHeight - 150) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, yPosition);
    yPosition += 10;

    const imageWidth = 40;
    const imageHeight = 30;
    const imagesPerRow = 2;
    const spacing = 10;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const row = Math.floor(i / imagesPerRow);
      const col = i % imagesPerRow;

      const x = margin + col * (imageWidth + spacing);
      const y = yPosition + row * (imageHeight + spacing + 15);

      // Check if we need a new page
      if (y + imageHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        // Recalculate positions for new page
        const newRow = Math.floor(i / imagesPerRow) - Math.floor(i / imagesPerRow);
        const newY = yPosition + newRow * (imageHeight + spacing + 15);

        try {
          await this.addImageToPdf(pdf, photo.url, x, newY, imageWidth, imageHeight);
          pdf.setFontSize(8);
          pdf.text(photo.description || 'Photo', x, newY + imageHeight + 5);
        } catch (error) {
          console.warn('Failed to add image to PDF:', error);
          // Add placeholder rectangle
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(x, newY, imageWidth, imageHeight);
          pdf.text('Image unavailable', x + 5, newY + imageHeight / 2);
        }
      } else {
        try {
          await this.addImageToPdf(pdf, photo.url, x, y, imageWidth, imageHeight);
          pdf.setFontSize(8);
          pdf.text(photo.description || 'Photo', x, y + imageHeight + 5);
        } catch (error) {
          console.warn('Failed to add image to PDF:', error);
          // Add placeholder rectangle
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(x, y, imageWidth, imageHeight);
          pdf.text('Image unavailable', x + 5, y + imageHeight / 2);
        }
      }
    }

    // Calculate final y position
    const totalRows = Math.ceil(photos.length / imagesPerRow);
    yPosition += totalRows * (imageHeight + spacing + 15) + 10;

    return yPosition;
  }

  /**
   * Add signature section
   */
  private async addSignatureSection(
    pdf: jsPDF,
    title: string,
    signature: ProcessSignature,
    yPosition: number,
    pageWidth: number,
    margin: number,
    pageHeight: number
  ): Promise<number> {
    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, yPosition);
    yPosition += 10;

    try {
      await this.addImageToPdf(pdf, signature.url, margin, yPosition, 80, 40);
    } catch (error) {
      console.warn('Failed to add signature to PDF:', error);
      // Add placeholder rectangle
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, yPosition, 80, 40);
      pdf.text('Signature unavailable', margin + 5, yPosition + 20);
    }

    yPosition += 45;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Signed by: ${signature.signerName}`, margin, yPosition);

    if (signature.signerPosition) {
      yPosition += 6;
      pdf.text(`Position: ${signature.signerPosition}`, margin, yPosition);
    }

    yPosition += 6;
    pdf.text(`Date: ${this.formatTimestamp(signature.uploadedAt)}`, margin, yPosition);

    return yPosition + 10;
  }

  /**
   * Add damage reports section
   */
  private addDamageReports(pdf: jsPDF, job: Job, processData: JobProcessData, yPosition: number, pageWidth: number, margin: number, pageHeight: number): number {
    // Check if we need a new page
    if (yPosition > pageHeight - 100) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('DAMAGE REPORT', margin, yPosition);
    yPosition += 15;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const damageData = [];

    damageData.push(['Overall Job Damage:', job.hasDamageCommitted ? 'REPORTED' : 'None']);

    if (processData.collection?.damageReportedThisStep !== undefined) {
      damageData.push(['Collection Damage:', processData.collection.damageReportedThisStep ? 'REPORTED' : 'None']);
    }

    if (processData.delivery?.damageReportedThisStep !== undefined) {
      damageData.push(['Delivery Damage:', processData.delivery.damageReportedThisStep ? 'REPORTED' : 'None']);
    }

    damageData.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, yPosition);
      pdf.setFont('helvetica', 'normal');

      if (value.includes('REPORTED')) {
        pdf.setTextColor(200, 0, 0);
      }
      pdf.text(value, margin + 50, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;
    });

    return yPosition + 10;
  }

  /**
   * Add notes section
   */
  private addNotesSection(pdf: jsPDF, job: Job, processData: JobProcessData, yPosition: number, pageWidth: number, margin: number, pageHeight: number): number {
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('ADDITIONAL NOTES', margin, yPosition);
    yPosition += 15;

    // General notes - Fixed TypeScript error
    if (job.generalNotes && Array.isArray(job.generalNotes) && job.generalNotes.length > 0) {
      const notesContent = this.extractNotesContent(job.generalNotes);
      if (notesContent) {
        yPosition = this.addNotesSubSection(pdf, 'General Job Notes', notesContent, yPosition, pageWidth, margin, pageHeight);
      }
    }

    return yPosition;
  }

  /**
   * Extract notes content with proper type handling
   */
  private extractNotesContent(notes: (JobNote | string)[]): string {
    return notes
      .map((note) => {
        if (typeof note === 'string') {
          return note;
        } else if (note && typeof note === 'object' && 'content' in note) {
          return note.content || '';
        }
        return '';
      })
      .filter((content) => content.trim().length > 0)
      .join('\n');
  }

  /**
   * Add notes subsection helper
   */
  private addNotesSubSection(pdf: jsPDF, title: string, content: string, yPosition: number, pageWidth: number, margin: number, pageHeight: number): number {
    if (!content || content.trim().length === 0) return yPosition;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    // Split long text into multiple lines
    const maxWidth = pageWidth - 2 * margin;
    const lines = pdf.splitTextToSize(content, maxWidth);

    lines.forEach((line: string) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 6;
    });

    return yPosition + 5;
  }

  /**
   * Add image to PDF helper
   */
  private async addImageToPdf(pdf: jsPDF, imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      // Create a temporary image element
      const img = new Image();
      img.crossOrigin = 'anonymous';

      return new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Create canvas to convert image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              pdf.addImage(dataUrl, 'JPEG', x, y, width, height);
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = reject;
        img.src = imageUrl;
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add report footer
   */
  private addReportFooter(pdf: jsPDF, job: Job, pageHeight: number): void {
    const margin = 20;
    const footerY = pageHeight - 15;

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);

    // Left side - company info
    pdf.text('CleanerPal Logistics | Belfast, Northern Ireland', margin, footerY);

    // Right side - page info
    const pageInfo = `Job ID: ${job.id.substring(0, 8)}... | Page ${pdf.getCurrentPageInfo().pageNumber}`;
    const pageInfoWidth = pdf.getTextWidth(pageInfo);
    pdf.text(pageInfo, pdf.internal.pageSize.getWidth() - margin - pageInfoWidth, footerY);
  }

  /**
   * Upload report to Firebase Storage
   */
  private uploadReportToStorage(jobId: string, pdfBlob: Blob, reportType: string): Observable<{ fileName: string; downloadUrl: string; fileSize: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportType}_Report_${jobId.substring(0, 8)}_${timestamp}.pdf`;
    const storagePath = `jobs/${jobId}/reports/${fileName}`;

    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    return this.storageService.uploadFile(storagePath, file).pipe(
      map((result) => ({
        fileName,
        downloadUrl: result.downloadUrl,
        fileSize: pdfBlob.size,
      }))
    );
  }

  /**
   * Format timestamp helper
   */
  private formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';

    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString('en-GB');
    }

    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('en-GB');
    }

    return new Date(timestamp).toLocaleString('en-GB');
  }

  /**
   * Helper methods
   */
  private getReportTitle(reportType: string): string {
    switch (reportType) {
      case 'POC':
        return 'PROOF OF COLLECTION';
      case 'POD':
        return 'PROOF OF DELIVERY';
      case 'COMBINED':
        return 'JOB COMPLETION REPORT';
      default:
        return 'VEHICLE LOGISTICS REPORT';
    }
  }

  private hasDamageReports(processData: JobProcessData): boolean {
    return !!(processData.collection?.damageReportedThisStep || processData.delivery?.damageReportedThisStep);
  }
}
