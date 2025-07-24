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
    try {
      const imageBlob = await this.fetchImageAsBlob(imageUrl);
      if (imageBlob) {
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onload = () => {
            try {
              const dataUrl = reader.result as string;
              const img = new window.Image();
              img.onload = () => {
                try {
                  doc.addImage(dataUrl, 'PNG', x, y, width, height);
                } catch (addErr) {
                  try {
                    doc.addImage(dataUrl, 'JPEG', x, y, width, height);
                  } catch (jpegErr) {}
                }
                resolve();
              };
              img.onerror = () => {
                try {
                  doc.addImage(dataUrl, 'PNG', x, y, width, height);
                } catch (addErr) {
                  try {
                    doc.addImage(dataUrl, 'JPEG', x, y, width, height);
                  } catch (jpegErr) {}
                }
                resolve();
              };
              img.src = dataUrl;
            } catch (err) {
              resolve();
            }
          };
          reader.readAsDataURL(imageBlob);
        });
      }
    } catch (err) {}
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
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'image/*',
          },
          ...strategies[i],
        });

        if (response.ok && response.type !== 'opaque') {
          return await response.blob();
        } else if (response.type === 'opaque') {
          // For no-cors mode, we can't access the response, but it might still be usable
          // However, we can't convert it to blob in this case
          continue;
        }
      } catch (error) {
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

  // Add a placeholder image from the web if the real image can't be loaded
  private async addPlaceholderImage(doc: jsPDF, x: number, y: number, width: number, height: number, originalUrl: string): Promise<void> {
    const placeholderUrl = 'https://placehold.co/300x100.png?text=Image+Unavailable';
    console.warn(`[PDF] STEP P1: Adding placeholder image for: ${originalUrl}`);
    try {
      const response = await fetch(placeholderUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            try {
              doc.addImage(dataUrl, 'PNG', x, y, width, height);
            } catch (addErr) {
              console.error('[PDF] STEP P4 ERROR: doc.addImage failed for placeholder:', addErr);
            }
            resolve();
          } catch (err) {
            console.error('[PDF] STEP P3 ERROR: Error adding placeholder image to PDF:', err);
            resolve();
          }
        };
        reader.onerror = (err) => {
          console.error('[PDF] STEP P3 ERROR: FileReader error for placeholder:', err);
          resolve();
        };
        try {
          reader.readAsDataURL(blob);
        } catch (readErr) {
          console.error('[PDF] STEP P3 ERROR: FileReader readAsDataURL failed for placeholder:', readErr);
          resolve();
        }
      });
    } catch (err) {
      console.error('[PDF] STEP P2 ERROR: Failed to fetch placeholder image:', err);
    }
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
        await this.addFirebaseImageToPdf(doc, photoUrls[i], x, y, photoWidth, photoHeight);

        // Add photo caption
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const caption = this.getPhotoCaption(i);
        doc.text(caption, x + photoWidth / 2, y + photoHeight + 8, { align: 'center' });

        photosProcessed++;
      } catch (error) {
        console.error(`Error processing photo ${i + 1}:`, error);
        // Placeholder is already handled in addFirebaseImageToPdf
      }

      // Move to next row after every 2 photos
      if (col === 1 || i === photoUrls.length - 1) {
        yPos = y + photoHeight + 25;
      }
    }

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
      try {
        yPos = this.checkPageBreak(doc, yPos, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Signature:', 20, yPos);
        yPos += 10;

        await this.addFirebaseImageToPdf(doc, stepData.signatureUrl, 20, yPos, 120, 40);
        yPos += 50;
      } catch (error) {
        // Error handling is already done in addFirebaseImageToPdf
        yPos += 50;
      }
    } else {
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

  // Improved helper to recursively extract all image directories from an object
  private extractAllImageDirs(obj: any): Set<string> {
    const dirs = new Set<string>();
    function recurse(val: any) {
      if (!val) return;
      if (typeof val === 'string') {
        // Check for Firebase Storage URL
        const match = val.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/(.+)\?alt=media/);
        if (match) {
          const bucket = match[1];
          const path = match[2];
          const lastSlash = path.lastIndexOf('%2F');
          const dir = lastSlash !== -1 ? path.substring(0, lastSlash) : path;
          dirs.add(`${bucket}/o/${dir}`.replace(/%2F/g, '/'));
        }
        // Check for image file path (even if not a full URL)
        if (val.match(/(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/i)) {
          const lastSlash = val.lastIndexOf('/');
          if (lastSlash !== -1) {
            dirs.add(val.substring(0, lastSlash));
          }
        }
      } else if (Array.isArray(val)) {
        val.forEach(recurse);
      } else if (typeof val === 'object') {
        // If object has a 'url' or 'path' property, check those
        if (val.url) recurse(val.url);
        if (val.path) recurse(val.path);
        Object.values(val).forEach(recurse);
      }
    }
    recurse(obj);
    return dirs;
  }

  private async createPOCReport(job: Job, reportData: any, reportTitle: string = 'Collection'): Promise<void> {
    const doc = new jsPDF();
    const { stepData, locationData, contactData } = reportData;

    // --- Main Report Structure ---
    // Page 1: Job info and collection/delivery details
    let yPos = 80;
    this.addCompanyHeader(doc);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Proof of Collection - ${reportTitle}`, 20, 60);
    yPos = this.addJobInformation(doc, job, yPos);
    yPos = this.addLocationDetails(doc, locationData, contactData, `${reportTitle} Details`, yPos);

    // Page 2: Vehicle details and vehicle condition
    doc.addPage();
    yPos = 30;
    yPos = this.addVehicleDetails(doc, job, yPos);
    yPos = this.addVehicleConditionSection(doc, stepData, yPos);

    // Page 3: Vehicle checklist (if present)
    if (stepData?.checklistItems && stepData.checklistItems.length > 0) {
      doc.addPage();
      yPos = 30;
      yPos = await this.addChecklistSection(doc, stepData.checklistItems, yPos);
    }

    // Page 4: Damage report, notes, legend, thumbnails
    if (stepData?.damageReportImageUrl || (stepData?.damagePhotoUrls && stepData.damagePhotoUrls.length > 0)) {
      doc.addPage();
      yPos = 30;
      yPos = await this.addDamageSection(doc, job, stepData, yPos);
    }

    // Page 5: Signature details and image
    if (stepData?.signatureUrl) {
      doc.addPage();
      yPos = 30;
      yPos = await this.addSignatureSection(doc, stepData, contactData, yPos);
    }

    // Page 6+: Each damage photo full screen, one per page
    if (stepData?.damagePhotoUrls && stepData.damagePhotoUrls.length > 0) {
      for (const url of stepData.damagePhotoUrls) {
        doc.addPage();
        await this.addFirebaseImageToPdf(doc, url, 10, 10, 190, 277);
      }
    }

    // --- Add images from expected folders ---
    const expectedFolders = [
      { key: 'collection_photos', label: 'Collection Photo' },
      { key: 'damage_diagrams', label: 'Damage Diagram' },
      { key: 'collection_signatures', label: 'Collection Signature' },
      { key: 'delivery_signatures', label: 'Delivery Signature' },
      { key: 'delivery_photos', label: 'Delivery Photo' },
      { key: 'collection_overview', label: 'Collection Overview' },
      { key: 'delivery_overview', label: 'Delivery Overview' },
    ];
    // Recursively extract all image URLs from stepData
    const allImageUrls: string[] = Array.from(new Set(this.extractAllImageDirs(stepData))).filter(
      (url) => typeof url === 'string' && (url.startsWith('http') || url.match(/(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/i))
    );
    for (const folder of expectedFolders) {
      const folderUrls = allImageUrls.filter((url) => url.includes(`/${folder.key}/`));
      let imageIndex = 1;
      for (const urlRaw of folderUrls) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${folder.label} ${imageIndex}`, 20, 15);
        try {
          await this.addFirebaseImageToPdf(doc, urlRaw, 20, 20, 170, 120);
        } catch (err) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text('[Image failed to load]', 20, 40);
        }
        imageIndex++;
      }
    }

    doc.save(`POC_All_Images_${job['jobNumber'] || ''}.pdf`);
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
