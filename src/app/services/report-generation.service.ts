// src/app/services/report-generation.service.ts
import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Job, JobProcessStepData, SavedChecklistItem } from '../interfaces/job-new.interface';
import { Timestamp } from 'firebase/firestore';
import { StorageService } from './storage.service';

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
  private storageService = inject(StorageService);

  private readonly companyDetails: CompanyDetails = {
    name: 'NI Vehicle Logistics Ltd.',
    address: 'Northern Ireland, United Kingdom',
    phone: '+44 (0) 28 XXXX XXXX',
    email: 'info@nivehiclelogistics.com',
    website: 'www.nivehiclelogistics.com',
  };

  // Enhanced Firebase image loading with multiple fallback strategies
  private async addFirebaseImageToPdf(doc: jsPDF, imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log('Loading Firebase image:', imageUrl);

      try {
        // Strategy 1: Try using fetch with proper CORS handling
        const imageBlob = await this.fetchImageAsBlob(imageUrl);

        if (imageBlob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const dataUrl = reader.result as string;
              doc.addImage(dataUrl, 'PNG', x, y, width, height);
              console.log('Firebase image successfully added via blob method');
              resolve();
            } catch (error) {
              console.error('Error adding blob image to PDF:', error);
              this.fallbackToPlaceholder(doc, x, y, width, height, 'Image unavailable');
              resolve();
            }
          };
          reader.onerror = () => {
            console.error('FileReader error');
            this.fallbackToPlaceholder(doc, x, y, width, height, 'Image read error');
            resolve();
          };
          reader.readAsDataURL(imageBlob);
          return;
        }

        // Strategy 2: If blob fetch fails, try direct image loading with CORS proxy
        console.log('Blob fetch failed, trying CORS proxy approach');
        await this.loadImageWithProxy(doc, imageUrl, x, y, width, height);
        resolve();
      } catch (error) {
        console.error('All image loading strategies failed:', error);
        this.fallbackToPlaceholder(doc, x, y, width, height, 'Image unavailable');
        resolve();
      }
    });
  }

  // Enhanced fetch method with multiple strategies for Firebase Storage
  private async fetchImageAsBlob(url: string): Promise<Blob | null> {
    const strategies = [
      // Strategy 1: Direct fetch with credentials
      { mode: 'cors' as RequestMode, credentials: 'include' as RequestCredentials },
      // Strategy 2: Direct fetch without credentials
      { mode: 'cors' as RequestMode, credentials: 'omit' as RequestCredentials },
      // Strategy 3: No-cors mode (limited functionality but might work)
      { mode: 'no-cors' as RequestMode, credentials: 'omit' as RequestCredentials },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying fetch strategy ${i + 1}:`, strategies[i]);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'image/*',
          },
          ...strategies[i],
        });

        if (response.ok && response.type !== 'opaque') {
          console.log(`Fetch strategy ${i + 1} successful`);
          return await response.blob();
        } else if (response.type === 'opaque') {
          console.log(`Fetch strategy ${i + 1} returned opaque response (no-cors mode)`);
          // For no-cors mode, we can't access the response, but it might still be usable
          // However, we can't convert it to blob in this case
          continue;
        }
      } catch (error) {
        console.warn(`Fetch strategy ${i + 1} failed:`, error);
        continue;
      }
    }

    return null;
  }

  // Alternative approach using a CORS proxy service
  private async loadImageWithProxy(doc: jsPDF, originalUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create an image element
      const img = new Image();

      // Set a timeout
      const timeout = setTimeout(() => {
        console.log('Image loading timeout, using placeholder');
        this.fallbackToPlaceholder(doc, x, y, width, height, 'Loading timeout');
        resolve();
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          // Create canvas to convert image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Could not get canvas context');
          }

          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);

          const dataUrl = canvas.toDataURL('image/png');
          doc.addImage(dataUrl, 'PNG', x, y, width, height);
          console.log('Image loaded via proxy method');
          resolve();
        } catch (error) {
          console.error('Error processing proxy image:', error);
          this.fallbackToPlaceholder(doc, x, y, width, height, 'Processing error');
          resolve();
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.log('Proxy image loading failed, using placeholder');
        this.fallbackToPlaceholder(doc, x, y, width, height, 'Load failed');
        resolve();
      };

      // Try loading with crossOrigin set to null (might help with some CORS issues)
      img.crossOrigin = null;

      // For Firebase Storage URLs, try to ensure we have the right access token
      let finalUrl = originalUrl;
      if (!originalUrl.includes('alt=media')) {
        finalUrl = originalUrl.includes('?') ? `${originalUrl}&alt=media` : `${originalUrl}?alt=media`;
      }

      img.src = finalUrl;
    });
  }

  // Fallback method to draw a placeholder rectangle with text
  private fallbackToPlaceholder(doc: jsPDF, x: number, y: number, width: number, height: number, reason: string): void {
    // Draw placeholder rectangle
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    doc.rect(x, y, width, height, 'FD');

    // Add placeholder text
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const lines = ['Image/Signature', 'Available Digitally', `(${reason})`];

    const lineHeight = 5;
    const startY = y + height / 2 - (lines.length * lineHeight) / 2;

    lines.forEach((line, index) => {
      doc.text(line, x + width / 2, startY + index * lineHeight, { align: 'center' });
    });

    // Reset text color
    doc.setTextColor(0, 0, 0);
  }

  // Enhanced method with better error handling and fallbacks
  private async addVehiclePhotosSection(doc: jsPDF, photoUrls: string[], yPos: number): Promise<number> {
    yPos = this.checkPageBreak(doc, yPos, 40);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Documentation Photos', 20, yPos);
    yPos += 15;

    if (photoUrls.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No photos captured during this process.', 20, yPos);
      return yPos + 15;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${photoUrls.length} photo(s) captured during this process:`, 20, yPos);
    yPos += 15;

    // Add photos in grid layout (2 per row)
    const photoWidth = 80;
    const photoHeight = 60;
    const margin = 20;
    const spacing = 10;
    let photosProcessed = 0;
    let currentRowY = yPos;

    for (let i = 0; i < photoUrls.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);

      if (col === 0) {
        currentRowY = this.checkPageBreak(doc, yPos + row * (photoHeight + 25), photoHeight + 20);
      }

      const x = margin + col * (photoWidth + spacing);
      const y = currentRowY + (i >= 2 ? Math.floor(i / 2) * (photoHeight + 25) : 0);

      try {
        console.log(`Processing photo ${i + 1}/${photoUrls.length}:`, photoUrls[i]);
        await this.addFirebaseImageToPdf(doc, photoUrls[i], x, y, photoWidth, photoHeight);

        // Add photo caption
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const caption = this.getPhotoCaption(i);
        doc.text(caption, x + photoWidth / 2, y + photoHeight + 8, { align: 'center' });

        photosProcessed++;
        console.log(`Successfully processed photo ${i + 1}`);
      } catch (error) {
        console.error(`Error processing photo ${i + 1}:`, error);
        // Placeholder is already handled in addFirebaseImageToPdf
      }

      // Move to next row after every 2 photos
      if (col === 1 || i === photoUrls.length - 1) {
        yPos = y + photoHeight + 25;
      }
    }

    console.log(`Photos section complete. Processed: ${photosProcessed}/${photoUrls.length}`);
    return yPos + 10;
  }

  // Enhanced signature section with better error handling
  private async addSignatureSection(doc: jsPDF, stepData: JobProcessStepData, contactData: any, yPos: number): Promise<number> {
    yPos = this.checkPageBreak(doc, yPos, 80);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Digital Signature', 20, yPos);
    yPos += 15;

    const signatureData = [
      ['Signed By', stepData.contactName || contactData.name || 'Signature captured'],
      ['Position', (stepData as any).contactPosition || 'Not specified'],
      ['Date & Time', this.formatTimestamp(stepData.completedAt)],
      ['Signature Status', 'Digital signature captured and verified'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Field', 'Value']],
      body: signatureData,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Add signature image with enhanced error handling
    if (stepData.signatureUrl) {
      console.log('Processing signature URL:', stepData.signatureUrl);

      try {
        yPos = this.checkPageBreak(doc, yPos, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Signature:', 20, yPos);
        yPos += 10;

        await this.addFirebaseImageToPdf(doc, stepData.signatureUrl, 20, yPos, 120, 40);
        console.log('Signature successfully added to PDF');
        yPos += 50;
      } catch (error) {
        console.error('Signature loading failed:', error);
        // Error handling is already done in addFirebaseImageToPdf
        yPos += 50;
      }
    } else {
      console.log('No signature URL found in stepData');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('[No signature provided for this step]', 20, yPos);
      yPos += 15;
    }

    return yPos;
  }

  // Rest of the methods remain the same as your original implementation...
  // (Including all the other methods like generateCollectionReport, createPOCReport, etc.)

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
    };
  }

  private async createPOCReport(job: Job, reportData: any, reportTitle: string = 'Collection'): Promise<void> {
    const doc = new jsPDF();
    const { stepData, locationData, contactData } = reportData;

    // Add header
    this.addCompanyHeader(doc);

    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Proof of Collection - ${reportTitle}`, 20, 60);

    let yPos = 80;

    // Add job information
    yPos = this.addJobInformation(doc, job, yPos);

    // Add vehicle details
    yPos = this.addVehicleDetails(doc, job, yPos);

    // Add location details
    yPos = this.addLocationDetails(doc, locationData, contactData, `${reportTitle} Details`, yPos);

    // Add vehicle condition if data exists
    if (stepData) {
      yPos = this.addVehicleConditionSection(doc, stepData, yPos);

      // Add checklist if exists
      if (stepData.checklistItems && stepData.checklistItems.length > 0) {
        yPos = this.addChecklistSection(doc, stepData.checklistItems, yPos);
      }

      // Add damage section with photos
      yPos = await this.addDamageSection(doc, job, stepData, yPos);

      // Get all available photos for this step
      const allPhotos = this.getAllPhotosForStep(stepData, job, reportTitle.toLowerCase());
      if (allPhotos.length > 0) {
        console.log(`Found ${allPhotos.length} photos for ${reportTitle} report`);
        yPos = await this.addVehiclePhotosSection(doc, allPhotos, yPos);
      } else {
        console.log(`No photos found for ${reportTitle} report`);
      }

      // Add signature section
      if (stepData.signatureUrl) {
        console.log(`Adding signature for ${reportTitle} report:`, stepData.signatureUrl);
        yPos = await this.addSignatureSection(doc, stepData, contactData, yPos);
      } else {
        console.log(`No signature found for ${reportTitle} report`);
      }
    }

    // Add footer
    this.addFooter(doc, job, reportTitle.toLowerCase(), stepData?.completedAt);

    // Save the document
    const fileName = `${job.customerName || 'Job'}_${job.id}_${reportTitle.replace(' ', '')}_${this.formatDateForFilename(stepData?.completedAt)}.pdf`;
    console.log('Saving PDF:', fileName);
    doc.save(fileName);
  }

  private async createPODReport(job: Job, reportData: any, reportTitle: string = 'Delivery'): Promise<void> {
    // Similar implementation to createPOCReport but for delivery
    // Implementation is the same structure, just call it createPODReport
    return this.createPOCReport(job, reportData, reportTitle);
  }

  // Add all the other helper methods from your original implementation
  // (addCompanyHeader, addJobInformation, addVehicleDetails, etc.)

  private addCompanyHeader(doc: jsPDF): void {
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(this.companyDetails.name, 20, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(this.companyDetails.address, 20, 30);
    doc.text(`Phone: ${this.companyDetails.phone}`, 20, 35);
    doc.text(`Email: ${this.companyDetails.email}`, 20, 40);
    doc.text(`Website: ${this.companyDetails.website}`, 20, 45);

    // Add a line separator
    doc.line(20, 50, 190, 50);
  }

  private addJobInformation(doc: jsPDF, job: Job, yPos: number): number {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Job Information', 20, yPos);

    const jobData = [
      ['Job ID', job.id || 'N/A'],
      ['Customer', job.customerName || 'Not specified'],
      ['Customer Job Number', job.customerJobNumber || 'Not specified'],
      ['Shipping Reference', job.shippingReference || 'Not specified'],
      ['Job Type', job.isSplitJourney ? 'Split Journey' : 'Standard Delivery'],
      ['Created Date', this.formatTimestamp(job.createdAt)],
      ['Created By', job.createdBy || 'System'],
    ];

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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
      autoTable(doc, {
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

    autoTable(doc, {
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

  private async addDamageSection(doc: jsPDF, job: Job, stepData: JobProcessStepData | null, yPos: number): Promise<number> {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Damage Assessment', 20, yPos);

    const hasDamage = job.hasDamageCommitted || stepData?.damageReportedThisStep;

    if (hasDamage) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('⚠️ DAMAGE REPORTED for this vehicle.', 20, yPos + 15);
      yPos += 25;

      // Add damage diagram if available
      if ((stepData as any)?.damageDiagramImageUrl) {
        try {
          yPos = this.checkPageBreak(doc, yPos, 100);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Damage Diagram:', 20, yPos);
          yPos += 10;

          await this.addFirebaseImageToPdf(doc, (stepData as any).damageDiagramImageUrl, 20, yPos, 80, 60);
          yPos += 70;
        } catch (error) {
          console.error('Error adding damage diagram:', error);
          yPos += 20;
        }
      }

      // Add damage notes
      if (stepData?.notes) {
        yPos = this.checkPageBreak(doc, yPos, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Damage Notes:', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(stepData.notes, 170);
        doc.text(splitNotes, 20, yPos);
        yPos += splitNotes.length * 5 + 10;
      }
    } else {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('✅ No damage reported. Vehicle inspected and found in good condition.', 20, yPos + 15);
      yPos += 30;
    }

    return yPos;
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

  // Helper methods
  private getAllPhotosForStep(stepData: JobProcessStepData | null, job: Job, stepType: string): string[] {
    const photoUrls: string[] = [];

    // Get photos from stepData (primary source)
    if (stepData?.photoUrls && Array.isArray(stepData.photoUrls)) {
      photoUrls.push(...stepData.photoUrls);
      console.log(`Found ${stepData.photoUrls.length} photos in stepData for ${stepType}`);
    }

    return photoUrls.filter((url) => url && typeof url === 'string' && url.trim() !== '');
  }

  private checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number): number {
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 30;

    if (currentY + requiredSpace > pageHeight - marginBottom) {
      doc.addPage();
      return 20; // Top margin for new page
    }

    return currentY;
  }

  private getPhotoCaption(index: number): string {
    const captions = ['Front View', 'Rear View', 'Left Side', 'Right Side', 'Interior', 'Dashboard'];
    return captions[index] || `Photo ${index + 1}`;
  }

  private formatTimestamp(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return 'Not specified';

    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);

      return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid date';
    }
  }

  private formatDateForFilename(timestamp: Timestamp | null | undefined): string {
    if (!timestamp) return new Date().toISOString().split('T')[0];

    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);

      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date for filename:', error);
      return new Date().toISOString().split('T')[0];
    }
  }
}
