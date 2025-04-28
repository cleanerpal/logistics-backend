import { CommonModule, NgFor, NgIf } from '@angular/common';
import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

// Firebase imports
import {
  collection,
  doc,
  Firestore,
  getDocs,
  Timestamp,
  writeBatch,
} from '@angular/fire/firestore';

// CSV parsing
import * as Papa from 'papaparse';

interface CsvRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  error: string;
}

@Component({
  selector: 'app-bulk-upload-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressBarModule,
    NgIf,
    NgFor,
    CommonModule,
    FormsModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Bulk Upload Jobs</h2>

    <mat-dialog-content class="mat-typography">
      <div class="upload-instructions">
        <p>
          Upload a CSV file with job data. The file must include the following
          required fields:
        </p>
        <ul>
          <li>Job ID</li>
          <li>Vehicle Type (Car, Van, Truck, Motorcycle)</li>
          <li>Collection Address</li>
          <li>Delivery Address</li>
          <li>Shipping Reference</li>
        </ul>
        <p>
          <a href="#" (click)="downloadTemplate($event)"
            >Download a template CSV</a
          >
          to see the expected format.
        </p>
      </div>

      <div class="file-upload-container">
        <input
          type="file"
          #fileInput
          accept=".csv"
          (change)="onFileSelected($event)"
          style="display: none"
        />
        <button mat-stroked-button color="primary" (click)="fileInput.click()">
          <mat-icon>attach_file</mat-icon>
          Select CSV File
        </button>
        <span class="file-name" *ngIf="file">{{ file.name }}</span>
      </div>

      <div class="validation-summary" *ngIf="validationComplete">
        <div class="validation-success" *ngIf="validationErrors.length === 0">
          <mat-icon>check_circle</mat-icon>
          <p>
            File validation successful! Ready to upload
            {{ validRows.length }} jobs.
          </p>
        </div>

        <div class="validation-errors" *ngIf="validationErrors.length > 0">
          <h3>Validation Errors ({{ validationErrors.length }})</h3>
          <p>The following errors were found in your CSV file:</p>

          <div class="error-list">
            <div
              class="error-item"
              *ngFor="let error of validationErrors.slice(0, 5)"
            >
              <strong>Row {{ error.row }}:</strong> {{ error.field }} - "{{
                error.value
              }}" - {{ error.error }}
            </div>

            <div *ngIf="validationErrors.length > 5">
              And {{ validationErrors.length - 5 }} more errors...
            </div>
          </div>

          <p>
            Please correct these errors and try again, or proceed with uploading
            the valid rows only.
          </p>

          <div class="valid-rows-summary" *ngIf="validRows.length > 0">
            <p>
              {{ validRows.length }} row(s) passed validation and are ready for
              upload.
            </p>
          </div>

          <button
            mat-stroked-button
            color="warn"
            (click)="downloadErrorReport()"
          >
            <mat-icon>download</mat-icon>
            Download Error Report
          </button>
        </div>
      </div>

      <div class="progress-container" *ngIf="uploading">
        <p>Uploading jobs... ({{ uploadProgress }}%)</p>
        <mat-progress-bar
          [value]="uploadProgress"
          mode="determinate"
        ></mat-progress-bar>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null" [disabled]="uploading">
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="uploadJobs()"
        [disabled]="!file || validRows.length === 0 || uploading"
      >
        Upload
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 600px;
      }

      .upload-instructions {
        margin-bottom: 24px;

        ul {
          padding-left: 24px;
          margin-bottom: 16px;
        }
      }

      .file-upload-container {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }

      .file-name {
        font-style: italic;
      }

      .validation-summary {
        margin-top: 24px;
        padding: 16px;
        border-radius: 4px;
        background-color: #f5f5f5;
      }

      .validation-success {
        display: flex;
        align-items: center;
        color: #4caf50;

        mat-icon {
          margin-right: 8px;
        }
      }

      .validation-errors {
        h3 {
          color: #f44336;
          margin-top: 0;
        }

        .error-list {
          background-color: rgba(244, 67, 54, 0.1);
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          max-height: 200px;
          overflow-y: auto;
        }

        .error-item {
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .valid-rows-summary {
          padding: 8px 0;
        }
      }

      .progress-container {
        margin-top: 24px;

        p {
          margin-bottom: 8px;
        }
      }
    `,
  ],
})
export class BulkUploadDialogComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private dialogRef: MatDialogRef<BulkUploadDialogComponent> = inject(
    MatDialogRef<BulkUploadDialogComponent>
  );
  private snackBar: MatSnackBar = inject(MatSnackBar);

  @ViewChild('fileInput') fileInput!: ElementRef;

  file: File | null = null;
  csvData: CsvRow[] = [];
  validRows: CsvRow[] = [];
  validationErrors: ValidationError[] = [];
  validationComplete = false;
  uploading = false;
  uploadProgress = 0;

  // Required fields in CSV
  requiredFields = [
    'jobId',
    'vehicleType',
    'collectionAddress',
    'deliveryAddress',
    'shippingReference',
  ];

  // Regular expression patterns for validation
  validationPatterns = {
    postcode: /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/,
    phone: /^(\+44|0)\d{10}$/,
    date: /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
  };

  ngOnInit(): void {
    // Initialize component
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    this.file = input.files[0];
    this.validationComplete = false;
    this.validationErrors = [];
    this.validRows = [];

    // Parse the CSV file
    this.parseCSV();
  }

  /**
   * Parse the CSV file
   */
  parseCSV(): void {
    if (!this.file) {
      return;
    }

    Papa.parse(this.file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.csvData = results.data as CsvRow[];
        this.validateCSV();
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        this.snackBar.open(
          'Error parsing CSV file. Please check the format.',
          'Close',
          {
            duration: 5000,
            panelClass: ['error-snackbar'],
          }
        );
      },
    });
  }

  /**
   * Validate the CSV data
   */
  async validateCSV(): Promise<void> {
    if (!this.csvData.length) {
      this.snackBar.open('The CSV file is empty.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.validationErrors = [];
    this.validRows = [];

    // Check for duplicate shipping references
    const shippingRefs = new Set<string>();

    // Get existing shipping references from Firestore
    const existingRefs = await this.getExistingShippingReferences();

    // Validate each row
    this.csvData.forEach((row, index) => {
      const rowNumber = index + 2; // +2 to account for 1-based indexing and header row
      const errors: ValidationError[] = [];

      // Check required fields
      this.requiredFields.forEach((field) => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({
            row: rowNumber,
            field,
            value: row[field] || '',
            error: 'Required field is missing or empty',
          });
        }
      });

      // Validate postcodes
      ['collectionPostcode', 'deliveryPostcode'].forEach((field) => {
        if (row[field] && !this.validationPatterns.postcode.test(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            value: row[field],
            error: 'Invalid UK postcode format',
          });
        }
      });

      // Validate phone numbers
      ['collectionPhone', 'deliveryPhone'].forEach((field) => {
        if (row[field] && !this.validationPatterns.phone.test(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            value: row[field],
            error: 'Invalid UK phone number format',
          });
        }
      });

      // Validate dates
      ['collectionDate', 'deliveryDate'].forEach((field) => {
        if (row[field] && !this.validationPatterns.date.test(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            value: row[field],
            error: 'Invalid date format (DD/MM/YYYY required)',
          });
        }
      });

      // Check for duplicate shipping references
      if (row['shippingReference']) {
        const ref = row['shippingReference'].trim();

        // Check if it's a duplicate in the current file
        if (shippingRefs.has(ref)) {
          errors.push({
            row: rowNumber,
            field: 'shippingReference',
            value: ref,
            error: 'Duplicate shipping reference in CSV file',
          });
        } else {
          shippingRefs.add(ref);
        }

        // Check if it already exists in the database
        if (existingRefs.has(ref)) {
          errors.push({
            row: rowNumber,
            field: 'shippingReference',
            value: ref,
            error: 'Shipping reference already exists in the system',
          });
        }
      }

      // Check vehicle type is valid
      if (row['vehicleType']) {
        const validTypes = ['Car', 'Van', 'Truck', 'Motorcycle'];
        if (!validTypes.includes(row['vehicleType'])) {
          errors.push({
            row: rowNumber,
            field: 'vehicleType',
            value: row['vehicleType'],
            error:
              'Invalid vehicle type. Must be one of: Car, Van, Truck, Motorcycle',
          });
        }
      }

      // Add any errors to the validation errors
      if (errors.length > 0) {
        this.validationErrors.push(...errors);
      } else {
        this.validRows.push(row);
      }
    });

    this.validationComplete = true;

    if (this.validationErrors.length === 0) {
      this.snackBar.open(
        `Validation successful. ${this.validRows.length} rows ready for upload.`,
        'Close',
        {
          duration: 5000,
        }
      );
    } else {
      this.snackBar.open(
        `Found ${this.validationErrors.length} errors in ${this.csvData.length} rows.`,
        'Close',
        {
          duration: 5000,
          panelClass: ['warning-snackbar'],
        }
      );
    }
  }

  /**
   * Get existing shipping references from Firestore
   */
  async getExistingShippingReferences(): Promise<Set<string>> {
    const existingRefs = new Set<string>();

    try {
      const jobsRef = collection(this.firestore, 'Jobs');
      const jobsSnapshot = await getDocs(jobsRef);

      jobsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data['shippingReference']) {
          existingRefs.add(data['shippingReference']);
        }
      });
    } catch (error) {
      console.error('Error getting existing shipping references:', error);
    }

    return existingRefs;
  }

  /**
   * Convert CSV row to Job object
   */
  convertRowToJob(row: CsvRow): any {
    // Parse dates from DD/MM/YYYY format to JavaScript Date objects
    const parseDate = (dateString: string): Date | null => {
      if (!dateString || !this.validationPatterns.date.test(dateString)) {
        return null;
      }

      const [day, month, year] = dateString.split('/').map(Number);
      return new Date(year, month - 1, day);
    };

    const collectionDate = parseDate(row['collectionDate']);
    const deliveryDate = parseDate(row['deliveryDate']);

    // Convert the CSV row to a job object
    return {
      jobType: row['jobType'] || 'Standard',
      customerReference: row['customerReference'] || '',
      shippingReference: row['shippingReference'],
      priority: row['priority']?.toLowerCase() === 'true' || false,
      vehicleType: row['vehicleType'],
      vehicleMake: row['vehicleMake'] || '',
      vehicleModel: row['vehicleModel'] || '',
      vehicleRegistration: row['vehicleRegistration'] || '',
      vehicleYear: parseInt(row['vehicleYear']) || new Date().getFullYear(),
      vehicleLocation: row['vehicleLocation'] || '',
      collectionBuilding: row['collectionBuilding'] || '',
      collectionStreet: row['collectionStreet'] || '',
      collectionCity: row['collectionCity'] || '',
      collectionPostcode: row['collectionPostcode'] || '',
      collectionCountry: row['collectionCountry'] || 'United Kingdom',
      collectionContactName: row['collectionContactName'] || '',
      collectionContactPhone: row['collectionContactPhone'] || '',
      collectionContactEmail: row['collectionContactEmail'] || '',
      collectionInstructions: row['collectionInstructions'] || '',
      deliveryBuilding: row['deliveryBuilding'] || '',
      deliveryStreet: row['deliveryStreet'] || '',
      deliveryCity: row['deliveryCity'] || '',
      deliveryPostcode: row['deliveryPostcode'] || '',
      deliveryCountry: row['deliveryCountry'] || 'United Kingdom',
      deliveryContactName: row['deliveryContactName'] || '',
      deliveryContactPhone: row['deliveryContactPhone'] || '',
      deliveryContactEmail: row['deliveryContactEmail'] || '',
      deliveryInstructions: row['deliveryInstructions'] || '',
      team: row['team'] || 'Unassigned',
      status: row['status'] || 'Unallocated',
      collectionDate: collectionDate
        ? Timestamp.fromDate(collectionDate)
        : Timestamp.now(),
      deliveryDate: deliveryDate
        ? Timestamp.fromDate(deliveryDate)
        : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  /**
   * Upload valid jobs to Firestore
   */
  async uploadJobs(): Promise<void> {
    if (this.validRows.length === 0) {
      this.snackBar.open('No valid rows to upload.', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    try {
      const batch = writeBatch(this.firestore);
      const jobsCollection = collection(this.firestore, 'Jobs');
      let successCount = 0;

      // Process in batches of 20 (Firestore batch limit is 500, but we're being conservative)
      const batchSize = 20;
      const totalBatches = Math.ceil(this.validRows.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, this.validRows.length);
        const currentBatch = this.validRows.slice(start, end);

        for (const row of currentBatch) {
          const jobData = this.convertRowToJob(row);
          const jobRef = doc(jobsCollection);
          batch.set(jobRef, jobData);
          successCount++;
        }

        // Update progress
        this.uploadProgress = Math.round(((i + 1) / totalBatches) * 100);
      }

      // Commit the batch
      await batch.commit();

      // Close the dialog with success result
      this.dialogRef.close({
        success: true,
        successCount,
      });
    } catch (error) {
      console.error('Error uploading jobs:', error);
      this.snackBar.open('Error uploading jobs. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.uploading = false;
      this.uploadProgress = 0;
    }
  }

  /**
   * Download a template CSV file
   */
  downloadTemplate(event: Event): void {
    event.preventDefault();

    const headers = [
      'jobId',
      'jobType',
      'customerReference',
      'shippingReference',
      'priority',
      'vehicleType',
      'vehicleMake',
      'vehicleModel',
      'vehicleRegistration',
      'vehicleYear',
      'vehicleLocation',
      'collectionBuilding',
      'collectionStreet',
      'collectionCity',
      'collectionPostcode',
      'collectionCountry',
      'collectionContactName',
      'collectionContactPhone',
      'collectionContactEmail',
      'collectionInstructions',
      'deliveryBuilding',
      'deliveryStreet',
      'deliveryCity',
      'deliveryPostcode',
      'deliveryCountry',
      'deliveryContactName',
      'deliveryContactPhone',
      'deliveryContactEmail',
      'deliveryInstructions',
      'team',
      'status',
      'collectionDate',
      'deliveryDate',
    ];

    const sampleRow = {
      jobId: 'JOB-001',
      jobType: 'Standard',
      customerReference: 'CUST-001',
      shippingReference: 'SHIP-001',
      priority: 'false',
      vehicleType: 'Car',
      vehicleMake: 'Ford',
      vehicleModel: 'Focus',
      vehicleRegistration: 'AB12 CDE',
      vehicleYear: '2022',
      vehicleLocation: 'Belfast Depot',
      collectionBuilding: '123',
      collectionStreet: 'Main Street',
      collectionCity: 'Belfast',
      collectionPostcode: 'BT1 1AA',
      collectionCountry: 'United Kingdom',
      collectionContactName: 'John Smith',
      collectionContactPhone: '07700900000',
      collectionContactEmail: 'john@example.com',
      collectionInstructions: 'Collect from reception',
      deliveryBuilding: '456',
      deliveryStreet: 'High Street',
      deliveryCity: 'London',
      deliveryPostcode: 'SW1A 1AA',
      deliveryCountry: 'United Kingdom',
      deliveryContactName: 'Jane Doe',
      deliveryContactPhone: '07700900001',
      deliveryContactEmail: 'jane@example.com',
      deliveryInstructions: 'Deliver to loading bay',
      team: 'Team A',
      status: 'Unallocated',
      collectionDate: '01/05/2025',
      deliveryDate: '05/05/2025',
    };

    const csvRows = [headers.join(',')];
    csvRows.push(
      headers
        .map((header) => sampleRow[header as keyof typeof sampleRow] || '')
        .join(',')
    );

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'jobs_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download error report as CSV
   */
  downloadErrorReport(): void {
    if (this.validationErrors.length === 0) {
      return;
    }

    // Create CSV content
    const headers = ['Row', 'Field', 'Value', 'Error'];
    const csvRows = [headers.join(',')];

    this.validationErrors.forEach((error) => {
      const row = [
        error.row,
        error.field,
        `"${error.value.replace(/"/g, '""')}"`, // Escape quotes
        `"${error.error.replace(/"/g, '""')}"`, // Escape quotes
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'job_upload_errors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
