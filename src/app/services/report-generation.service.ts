// src/app/services/report-generation.service.ts
import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Job, JobProcessStepData, SavedChecklistItem } from '../interfaces/job-new.interface';
import { Timestamp } from 'firebase/firestore';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

export interface CompanyDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReportGenerationService {
  private readonly companyDetails: CompanyDetails = {
    name: 'NI Vehicle Logistics Ltd.',
    address: 'Northern Ireland, United Kingdom',
    phone: '+44 (0) 28 XXXX XXXX',
    email: 'info@nivehiclelogistics.com',
    website: 'www.nivehiclelogistics.com',
  };

  constructor() {}

  async generateCollectionReport(job: Job): Promise<void> {
    const reportData = this.prepareReportData(job, 'collection');
    await this.createPOCReport(job, reportData);
  }

  async generateSecondaryCollectionReport(job: Job): Promise<void> {
    const reportData = this.prepareReportData(job, 'secondaryCollection');
    await this.createPOCReport(job, reportData, 'Secondary Collection');
  }

  async generateFirstDeliveryReport(job: Job): Promise<void> {
    const reportData = this.prepareReportData(job, 'firstDelivery');
    await this.createPODReport(job, reportData, 'First Delivery');
  }

  async generateDeliveryReport(job: Job): Promise<void> {
    const reportData = this.prepareReportData(job, 'delivery');
    await this.createPODReport(job, reportData);
  }

  private prepareReportData(job: Job, type: 'collection' | 'secondaryCollection' | 'firstDelivery' | 'delivery') {
    let stepData: JobProcessStepData | null = null;
    let locationData: any = {};
    let contactData: any = {};

    switch (type) {
      case 'collection':
        stepData = job.collectionData || null;
        locationData = {
          address: job.collectionAddress || null,
          city: job.collectionCity || null,
          postcode: job.collectionPostcode || null,
        };
        contactData = {
          name: job.collectionContactName || null,
          phone: job.collectionContactPhone || null,
          email: job.collectionContactEmail || null,
        };
        break;
      case 'secondaryCollection':
        stepData = job.secondaryCollectionData || null;
        locationData = {
          address: job.secondaryCollectionAddress || null,
          city: job.secondaryCollectionCity || null,
          postcode: job.secondaryCollectionPostcode || null,
        };
        contactData = {
          name: job.secondaryCollectionContactName || null,
          phone: job.secondaryCollectionContactPhone || null,
          email: job.secondaryCollectionContactEmail || null,
        };
        break;
      case 'firstDelivery':
        stepData = job.firstDeliveryData || null;
        locationData = {
          address: job.firstDeliveryAddress || null,
          city: job.firstDeliveryCity || null,
          postcode: job.firstDeliveryPostcode || null,
        };
        contactData = {
          name: job.firstDeliveryContactName || null,
          phone: job.firstDeliveryContactPhone || null,
          email: job.firstDeliveryContactEmail || null,
        };
        break;
      case 'delivery':
        stepData = job.deliveryData || null;
        locationData = {
          address: job.deliveryAddress || null,
          city: job.deliveryCity || null,
          postcode: job.deliveryPostcode || null,
        };
        contactData = {
          name: job.deliveryContactName || null,
          phone: job.deliveryContactPhone || null,
          email: job.deliveryContactEmail || null,
        };
        break;
    }

    return {
      stepData,
      locationData,
      contactData,
      type,
    };
  }

  private async createPOCReport(job: Job, reportData: any, title: string = 'Collection'): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Header
    yPos = this.addHeader(doc, `Proof of Collection (POC) - ${title}`, yPos);

    // Company Details
    yPos = this.addCompanyDetails(doc, yPos);

    // Job Information
    yPos = this.addJobInformation(doc, job, yPos);

    // Vehicle Details
    yPos = this.addVehicleDetails(doc, job, yPos);

    // Collection Location Details
    yPos = this.addLocationDetails(doc, reportData.locationData, reportData.contactData, `${title} Location`, yPos);

    // Vehicle Checklist
    if (reportData.stepData?.checklistItems) {
      yPos = this.addChecklistSection(doc, reportData.stepData.checklistItems, yPos);
    }

    // Vehicle Condition
    if (reportData.stepData?.mileage || reportData.stepData?.fuelLevel) {
      yPos = this.addVehicleConditionSection(doc, reportData.stepData, yPos);
    }

    // Damage Section
    yPos = this.addDamageSection(doc, job, reportData.stepData, yPos);

    // Photos Section
    if (reportData.stepData?.photoUrls && reportData.stepData.photoUrls.length > 0) {
      yPos = this.addPhotosSection(doc, reportData.stepData.photoUrls, yPos);
    }

    // Signature Section
    if (reportData.stepData?.signatureUrl) {
      yPos = this.addSignatureSection(doc, reportData.stepData, reportData.contactData, yPos);
    }

    // Footer
    this.addFooter(doc, job, `POC-${title}`, reportData.stepData?.completedAt);

    // Save the PDF
    const fileName = `POC_${title}_${job.vehicleRegistration || job.id}_${this.formatDateForFilename(reportData.stepData?.completedAt)}.pdf`;
    doc.save(fileName);
  }

  private async createPODReport(job: Job, reportData: any, title: string = 'Delivery'): Promise<void> {
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    yPos = this.addHeader(doc, `Proof of Delivery (POD) - ${title}`, yPos);

    // Company Details
    yPos = this.addCompanyDetails(doc, yPos);

    // Job Information
    yPos = this.addJobInformation(doc, job, yPos);

    // Vehicle Details
    yPos = this.addVehicleDetails(doc, job, yPos);

    // Delivery Location Details
    yPos = this.addLocationDetails(doc, reportData.locationData, reportData.contactData, `${title} Location`, yPos);

    // Vehicle Checklist
    if (reportData.stepData?.checklistItems) {
      yPos = this.addChecklistSection(doc, reportData.stepData.checklistItems, yPos);
    }

    // Vehicle Condition
    if (reportData.stepData?.mileage || reportData.stepData?.fuelLevel) {
      yPos = this.addVehicleConditionSection(doc, reportData.stepData, yPos);
    }

    // Damage Section
    yPos = this.addDamageSection(doc, job, reportData.stepData, yPos);

    // Photos Section
    if (reportData.stepData?.photoUrls && reportData.stepData.photoUrls.length > 0) {
      yPos = this.addPhotosSection(doc, reportData.stepData.photoUrls, yPos);
    }

    // Signature Section
    if (reportData.stepData?.signatureUrl) {
      yPos = this.addSignatureSection(doc, reportData.stepData, reportData.contactData, yPos);
    }

    // Footer
    this.addFooter(doc, job, `POD-${title}`, reportData.stepData?.completedAt);

    // Save the PDF
    const fileName = `POD_${title}_${job.vehicleRegistration || job.id}_${this.formatDateForFilename(reportData.stepData?.completedAt)}.pdf`;
    doc.save(fileName);
  }

  private addHeader(doc: jsPDF, title: string, yPos: number): number {
    const pageWidth = doc.internal.pageSize.width;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, yPos, { align: 'center' });

    return yPos + 15;
  }

  private addCompanyDetails(doc: jsPDF, yPos: number): number {
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(this.companyDetails.name, 20, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(this.companyDetails.address, 20, yPos + 6);
    doc.text(`Phone: ${this.companyDetails.phone}`, 20, yPos + 12);
    doc.text(`Email: ${this.companyDetails.email}`, 20, yPos + 18);
    doc.text(`Website: ${this.companyDetails.website}`, 20, yPos + 24);

    // Add a line separator
    doc.line(20, yPos + 30, pageWidth - 20, yPos + 30);

    return yPos + 40;
  }

  private addJobInformation(doc: jsPDF, job: Job, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Job Information', 20, yPos);

    const jobData = [
      ['Job ID', job.id.substring(0, 8) + '...'],
      ['Customer', job.customerName || 'Not specified'],
      ['Customer Job Number', job.customerJobNumber || 'Not specified'],
      ['Shipping Reference', job.shippingReference || 'Not specified'],
      ['Job Type', job.isSplitJourney ? 'Split Journey' : 'Standard Delivery'],
      ['Created Date', this.formatTimestamp(job.createdAt)],
      ['Created By', job.createdBy || 'System'],
    ];

    doc.autoTable({
      startY: yPos + 5,
      head: [['Field', 'Value']],
      body: jobData,
      theme: 'grid',
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 20, right: 20 },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  private addVehicleDetails(doc: jsPDF, job: Job, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Details', 20, yPos);

    const vehicleData = [
      ['Registration', job.vehicleRegistration || 'Not specified'],
      ['Make', job.vehicleMake || 'Not specified'],
      ['Model', job.vehicleModel || 'Not specified'],
      ['Year', job.vehicleYear?.toString() || 'Not specified'],
      ['Color', job.vehicleColor || 'Not specified'],
      ['Type', job.vehicleType || 'Not specified'],
      ['Chassis Number', job.chassisNumber || 'Not specified'],
    ];

    doc.autoTable({
      startY: yPos + 5,
      head: [['Field', 'Value']],
      body: vehicleData,
      theme: 'grid',
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 20, right: 20 },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  private addLocationDetails(doc: jsPDF, locationData: any, contactData: any, title: string, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, yPos);

    const locationInfo = [
      ['Address', locationData.address || 'Not specified'],
      ['City', locationData.city || 'Not specified'],
      ['Postcode', locationData.postcode || 'Not specified'],
      ['Contact Name', contactData.name || 'Not specified'],
      ['Contact Phone', contactData.phone || 'Not specified'],
      ['Contact Email', contactData.email || 'Not specified'],
    ];

    doc.autoTable({
      startY: yPos + 5,
      head: [['Field', 'Value']],
      body: locationInfo,
      theme: 'grid',
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 20, right: 20 },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  private addVehicleConditionSection(doc: jsPDF, stepData: JobProcessStepData, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Condition', 20, yPos);

    const conditionData = [];

    if (stepData.mileage !== undefined && stepData.mileage !== null) {
      conditionData.push(['Mileage', `${stepData.mileage} miles`]);
    }

    if (stepData.fuelLevel !== undefined && stepData.fuelLevel !== null) {
      const energyType = (stepData as any).energyType || 'fuel';
      const levelLabel = energyType.toLowerCase() === 'electric' ? 'charge' : 'fuel';
      conditionData.push(['Energy Level', `${stepData.fuelLevel}% ${levelLabel}`]);
    }

    if ((stepData as any).energyType) {
      conditionData.push(['Energy Type', (stepData as any).energyType]);
    }

    if (conditionData.length > 0) {
      doc.autoTable({
        startY: yPos + 5,
        head: [['Condition', 'Value']],
        body: conditionData,
        theme: 'striped',
        headStyles: { fillColor: [34, 139, 34] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        margin: { left: 20, right: 20 },
      });

      return (doc as any).lastAutoTable.finalY + 15;
    }

    return yPos + 10;
  }

  private addChecklistSection(doc: jsPDF, checklistItems: SavedChecklistItem[], yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Checklist', 20, yPos);

    const checklistData = checklistItems.map((item) => [item.name, item.isChecked ? '✓' : '✗', item.category || 'General']);

    doc.autoTable({
      startY: yPos + 5,
      head: [['Item', 'Status', 'Category']],
      body: checklistData,
      theme: 'striped',
      headStyles: { fillColor: [65, 105, 225] },
      columnStyles: {
        1: { halign: 'center', cellWidth: 20 },
        2: { cellWidth: 30 },
      },
      margin: { left: 20, right: 20 },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  private addDamageSection(doc: jsPDF, job: Job, stepData: JobProcessStepData | null, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Damage Report', 20, yPos);

    if (job.hasDamageCommitted || stepData?.damageReportedThisStep) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Damage has been reported for this vehicle.', 20, yPos + 10);
      doc.text('Please refer to attached damage photos and reports for details.', 20, yPos + 20);
      return yPos + 35;
    } else {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('No damage reported. Vehicle inspected and found in good condition.', 20, yPos + 10);
      return yPos + 25;
    }
  }

  private addPhotosSection(doc: jsPDF, photoUrls: string[], yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Photos', 20, yPos);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${photoUrls.length} photo(s) captured during this process.`, 20, yPos + 10);
    doc.text('Photos are stored digitally and can be accessed via the NI Vehicle Logistics portal.', 20, yPos + 16);

    return yPos + 30;
  }

  private addSignatureSection(doc: jsPDF, stepData: JobProcessStepData, contactData: any, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Digital Signature', 20, yPos);

    const signatureData = [
      ['Signed By', stepData.contactName || contactData.name || 'Signature captured'],
      ['Position', (stepData as any).contactPosition || 'Not specified'],
      ['Date & Time', this.formatTimestamp(stepData.completedAt)],
      ['Signature Status', 'Digital signature captured and verified'],
    ];

    doc.autoTable({
      startY: yPos + 5,
      head: [['Field', 'Value']],
      body: signatureData,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 20, right: 20 },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  private addFooter(doc: jsPDF, job: Job, reportType: string, completedAt: Timestamp | null | undefined): void {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    // Footer line
    doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30);

    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report ID: ${job.id}-${reportType}-${this.formatDateForFilename(completedAt)}`, 20, pageHeight - 20);
    doc.text(`Generated by: ${this.companyDetails.name}`, 20, pageHeight - 15);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, pageHeight - 10);

    // Page number
    doc.text(`Page 1 of 1`, pageWidth - 40, pageHeight - 10);
  }

  private formatTimestamp(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return 'Not specified';

    try {
      // Handle both Timestamp objects and timestamp-like objects
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);

      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  private formatDateForFilename(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return new Date().toISOString().split('T')[0].replace(/-/g, '');

    try {
      // Handle both Timestamp objects and timestamp-like objects
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);

      return date.toISOString().split('T')[0].replace(/-/g, '');
    } catch (error) {
      return new Date().toISOString().split('T')[0].replace(/-/g, '');
    }
  }
}
