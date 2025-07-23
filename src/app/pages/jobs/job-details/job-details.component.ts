// job-details.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, Subject, forkJoin, of } from 'rxjs';
import { finalize, takeUntil, catchError, map, tap, startWith } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { Job, JobNote } from '../../../interfaces/job-new.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { JobNewService } from '../../../services/job-new.service';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { JobProcessData, JobProcessService, ProcessPhoto } from '../../../services/job-process.service';
import { ProcessSignature } from '../../../services/job-process.service';
import { ReportGenerationService } from '../../../services/report-generation.service';

// Enhanced interfaces for documents
export interface JobDocument {
  id: string;
  type: 'photo' | 'signature' | 'damage_diagram';
  category: 'collection' | 'delivery' | 'secondary_collection' | 'first_delivery' | 'damage';
  url: string;
  fileName: string;
  description: string;
  uploadedAt: Date;
  size?: number;
}

export interface DamageReport {
  id: string;
  reportedAt: Timestamp;
  reportedBy: string;
  reportedByName: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  location: 'front' | 'rear' | 'left' | 'right' | 'interior' | 'undercarriage' | 'other';
  photos: string[];
  diagrams: string[];
  notes?: string;
  repairEstimate?: number;
  repairCompleted?: boolean;
  repairCompletedAt?: Timestamp;
}

// Enhanced expense interface matching mobile app
export interface JobExpense {
  id: string;
  type: 'fuel' | 'tolls' | 'parking' | 'car_wash' | 'other';
  description: string;
  amount: number;
  liters?: number; // For fuel expenses
  date: Timestamp;
  receiptUrl?: string;
  addedBy: string;
  addedByName: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  isChargeable: boolean; // Whether to charge to customer
  notes?: string;
}

export interface PricingItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  total: number;
  isCustom: boolean; // Whether it's a custom item or standard service
}

export interface JobBilling {
  basePrice: number; // Initial job cost
  additionalItems: PricingItem[];
  expenses: JobExpense[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  invoiceNumber?: string;
  invoiceDate?: Timestamp;
  dueDate?: Timestamp;
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  customerChargeableTotal?: number; // Total amount to charge customer (excluding internal costs)
}

@Component({
  selector: 'app-job-details',
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
  standalone: false,
})
export class JobDetailsComponent implements OnInit, OnDestroy {
  job: Job | null = null;
  loading = true;
  error: string | null = null;

  currentUser: UserProfile | null = null;
  canEditJobs = false;
  canManageJobs = false;
  canManageBilling = false;

  // Document loading states
  documentsLoading = false;
  documentsError: string | null = null;

  // Enhanced document management
  allDocuments: JobDocument[] = [];
  collectionPhotos: JobDocument[] = [];
  deliveryPhotos: JobDocument[] = [];
  secondaryCollectionPhotos: JobDocument[] = [];
  firstDeliveryPhotos: JobDocument[] = [];
  collectionSignatures: JobDocument[] = [];
  deliverySignatures: JobDocument[] = [];
  secondaryCollectionSignatures: JobDocument[] = [];
  firstDeliverySignatures: JobDocument[] = [];
  damagePhotos: JobDocument[] = [];
  damageDiagrams: JobDocument[] = [];

  // Damage reports
  damageReports: DamageReport[] = [];
  hasDamageReported = false;

  // Billing data
  jobBilling: JobBilling | null = null;
  isLoadingBilling = false;

  // Report generation
  generatingReport = false;
  currentReportType: string = '';

  // Add expense form data
  newExpense = {
    type: 'fuel' as const,
    description: '',
    amount: 0,
    liters: 0,
    receiptUrl: '',
    isChargeable: true,
    notes: '',
  };

  // Add pricing item form data
  newPricingItem = {
    name: '',
    description: '',
    price: 0,
    quantity: 1,
  };

  // Enhanced expense types matching mobile app
  expenseTypes = [
    { value: 'fuel', label: 'Fuel', icon: 'local_gas_station', requiresLiters: true },
    { value: 'tolls', label: 'Tolls', icon: 'toll', requiresLiters: false },
    { value: 'parking', label: 'Parking', icon: 'local_parking', requiresLiters: false },
    { value: 'accommodation', label: 'Accommodation', icon: 'hotel', requiresLiters: false },
    { value: 'meals', label: 'Meals', icon: 'restaurant', requiresLiters: false },
    { value: 'car_wash', label: 'Car Wash', icon: 'local_car_wash', requiresLiters: false },
    { value: 'vacuum', label: 'Vacuum', icon: 'cleaning_services', requiresLiters: false },
    { value: 'repairs', label: 'Repairs', icon: 'build', requiresLiters: false },
    { value: 'other', label: 'Other', icon: 'receipt', requiresLiters: false },
  ];

  // Standard pricing items for quick addition
  standardPricingItems = [
    { name: 'Collection Service', description: 'Vehicle collection service', price: 50.0 },
    { name: 'Delivery Service', description: 'Vehicle delivery service', price: 50.0 },
    { name: 'Storage (per day)', description: 'Vehicle storage per day', price: 15.0 },
    { name: 'Washing Service', description: 'Vehicle washing service', price: 25.0 },
    { name: 'Express Service', description: 'Same day service premium', price: 75.0 },
    { name: 'Mileage (per mile)', description: 'Additional mileage charge', price: 1.5 },
    { name: 'Cleaning Service', description: 'Interior/exterior cleaning', price: 35.0 },
    { name: 'Inspection Service', description: 'Vehicle condition inspection', price: 20.0 },
  ];

  selectedTabIndex = 0;
  private destroy$ = new Subject<void>();

  // Process data
  jobProcessData: JobProcessData | null = null;
  damageReports_old = { collection: false, delivery: false, overall: false };
  processContacts: any = {};
  vehicleCondition: any = {};

  // Timeline data
  timelineEvents: any[] = [];

  // Notes data
  formattedNotes: any[] = [];

  canViewReports = false;

  @ViewChild('reportContent', { static: false }) reportContent!: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobNewService,
    private authService: AuthService,
    private storageService: StorageService,
    private reportGenerationService: ReportGenerationService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private jobProcessService: JobProcessService
  ) {}

  ngOnInit(): void {
    this.initializePermissions();
    this.loadJob();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePermissions(): void {
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.canEditJobs = user?.permissions?.canEditJobs || user?.permissions?.isAdmin || false;
        this.canManageJobs = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
        this.canManageBilling = user?.permissions?.['canManageBilling'] || user?.permissions?.isAdmin || false;
        this.canViewReports = user?.permissions?.['canViewReports'] || user?.permissions?.isAdmin || false;
      });
  }

  private loadJob(): void {
    const jobId = this.route.snapshot.paramMap.get('id');
    if (!jobId) {
      this.error = 'Job ID not found';
      this.loading = false;
      return;
    }

    this.loading = true;

    // Load job data and process data in parallel
    combineLatest([
      this.jobService.getJobById(jobId),
      this.jobProcessService.getJobProcessData(jobId),
      this.jobProcessService.getDamageReports(jobId),
      this.jobProcessService.getProcessContacts(jobId),
      this.jobProcessService.getVehicleConditionData(jobId),
    ])
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: ([job, processData, damageReports, contacts, vehicleCondition]) => {
          if (job) {
            this.job = job;
            this.jobProcessData = processData;
            this.damageReports_old = damageReports;
            this.processContacts = contacts;
            this.vehicleCondition = vehicleCondition;

            this.extractProcessDocuments(processData);
            this.generateTimelineEvents();
            this.formatJobNotes();
            this.loadJobDocuments(jobId);
            this.loadDamageReports(jobId);

            // Load billing if user has permission
            if (this.canManageBilling) {
              this.loadBillingData();
            }
          } else {
            this.error = 'Job not found';
          }
        },
        error: (error) => {
          console.error('Error loading job details:', error);
          this.error = 'Failed to load job details';
          this.showError('Failed to load job details');
        },
      });
  }

  // Enhanced document loading from Firebase Storage
  loadJobDocuments(jobId: string): void {
    this.documentsLoading = true;
    this.documentsError = null;

    const documentPaths = [
      { path: `jobs/${jobId}/collection_photos`, category: 'collection', type: 'photo' },
      { path: `jobs/${jobId}/delivery_photos`, category: 'delivery', type: 'photo' },
      { path: `jobs/${jobId}/secondary_collection_photos`, category: 'secondary_collection', type: 'photo' },
      { path: `jobs/${jobId}/first_delivery_photos`, category: 'first_delivery', type: 'photo' },
      { path: `jobs/${jobId}/collection_signatures`, category: 'collection', type: 'signature' },
      { path: `jobs/${jobId}/delivery_signatures`, category: 'delivery', type: 'signature' },
      { path: `jobs/${jobId}/secondary_collection_signatures`, category: 'secondary_collection', type: 'signature' },
      { path: `jobs/${jobId}/first_delivery_signatures`, category: 'first_delivery', type: 'signature' },
      { path: `jobs/${jobId}/damage_photos`, category: 'damage', type: 'photo' },
      { path: `jobs/${jobId}/damage_diagrams`, category: 'damage', type: 'damage_diagram' },
    ];

    const documentObservables = documentPaths.map((pathConfig) =>
      this.storageService.listFiles(pathConfig.path).pipe(
        startWith([]),
        map((files) =>
          files.map((file) => ({
            id: file.name,
            type: pathConfig.type as 'photo' | 'signature' | 'damage_diagram',
            category: pathConfig.category as JobDocument['category'],
            url: file.downloadUrl || '',
            fileName: file.name,
            description: this.getDocumentDescription(file.name, pathConfig.category, pathConfig.type),
            uploadedAt: file.timeCreated ? new Date(file.timeCreated) : new Date(),
            size: file.size,
          }))
        ),
        catchError(() => of([] as JobDocument[]))
      )
    );

    combineLatest(documentObservables)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.documentsLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (documentArrays) => {
          this.allDocuments = documentArrays.flat();
          this.categorizeDocuments();
          this.hasDamageReported = this.damagePhotos.length > 0 || this.damageDiagrams.length > 0;
          this.syncDocumentsToProcessData();
        },
        error: () => {
          this.documentsError = 'Failed to load documents';
          this.showError('Failed to load job documents');
        },
      });
  }

  // Load damage reports from job data
  private loadDamageReports(jobId: string): void {
    // Extract damage reports from job data
    if (this.job?.collectionData?.damageReportedThisStep || this.job?.deliveryData?.damageReportedThisStep || this.job?.hasDamageCommitted) {
      const reports: DamageReport[] = [];

      if (this.job.collectionData?.damageReportedThisStep) {
        reports.push({
          id: `collection_damage_${jobId}`,
          reportedAt: Timestamp.now(),
          reportedBy: 'system',
          reportedByName: 'Collection Process',
          description: 'Damage reported during collection process',
          severity: 'moderate',
          location: 'other',
          photos: this.damagePhotos.filter((photo) => photo.fileName.includes('collection')).map((photo) => photo.url),
          diagrams: this.damageDiagrams.filter((diagram) => diagram.fileName.includes('collection')).map((diagram) => diagram.url),
          notes: this.job.collectionData?.notes || '',
        });
      }

      if (this.job.deliveryData?.damageReportedThisStep) {
        reports.push({
          id: `delivery_damage_${jobId}`,
          reportedAt: Timestamp.now(),
          reportedBy: 'system',
          reportedByName: 'Delivery Process',
          description: 'Damage reported during delivery process',
          severity: 'moderate',
          location: 'other',
          photos: this.damagePhotos.filter((photo) => photo.fileName.includes('delivery')).map((photo) => photo.url),
          diagrams: this.damageDiagrams.filter((diagram) => diagram.fileName.includes('delivery')).map((diagram) => diagram.url),
          notes: this.job.deliveryData?.notes || '',
        });
      }

      this.damageReports = reports;
    }
  }

  // Categorize documents by type and category
  private categorizeDocuments(): void {
    this.collectionPhotos = this.allDocuments.filter((doc) => doc.category === 'collection' && doc.type === 'photo');
    this.deliveryPhotos = this.allDocuments.filter((doc) => doc.category === 'delivery' && doc.type === 'photo');
    this.secondaryCollectionPhotos = this.allDocuments.filter((doc) => doc.category === 'secondary_collection' && doc.type === 'photo');
    this.firstDeliveryPhotos = this.allDocuments.filter((doc) => doc.category === 'first_delivery' && doc.type === 'photo');

    this.collectionSignatures = this.allDocuments.filter((doc) => doc.category === 'collection' && doc.type === 'signature');
    this.deliverySignatures = this.allDocuments.filter((doc) => doc.category === 'delivery' && doc.type === 'signature');
    this.secondaryCollectionSignatures = this.allDocuments.filter((doc) => doc.category === 'secondary_collection' && doc.type === 'signature');
    this.firstDeliverySignatures = this.allDocuments.filter((doc) => doc.category === 'first_delivery' && doc.type === 'signature');

    this.damagePhotos = this.allDocuments.filter((doc) => doc.category === 'damage' && doc.type === 'photo');
    this.damageDiagrams = this.allDocuments.filter((doc) => doc.category === 'damage' && doc.type === 'damage_diagram');
  }

  // Sync all loaded document URLs into jobProcessData for report generation
  private syncDocumentsToProcessData(): void {
    if (!this.jobProcessData) return;

    // Sync collection photos
    this.jobProcessData.collection = this.jobProcessData.collection || {};
    this.jobProcessData.collection.photoUrls = this.collectionPhotos.map((doc) => doc.url);

    // Sync delivery photos
    this.jobProcessData.delivery = this.jobProcessData.delivery || {};
    this.jobProcessData.delivery.photoUrls = this.deliveryPhotos.map((doc) => doc.url);

    // Sync secondary collection photos
    if (this.jobProcessData.secondaryCollection) {
      this.jobProcessData.secondaryCollection.photoUrls = this.secondaryCollectionPhotos.map((doc) => doc.url);
    }
    // Sync first delivery photos
    if (this.jobProcessData.firstDelivery) {
      this.jobProcessData.firstDelivery.photoUrls = this.firstDeliveryPhotos.map((doc) => doc.url);
    }

    // Sync signatures (first one per category)
    const collectionSignature = this.collectionSignatures[0];
    if (collectionSignature) {
      this.jobProcessData.collection.signatureUrl = collectionSignature.url;
    }
    const deliverySignature = this.deliverySignatures[0];
    if (deliverySignature) {
      this.jobProcessData.delivery.signatureUrl = deliverySignature.url;
    }
    if (this.jobProcessData.secondaryCollection && this.secondaryCollectionSignatures[0]) {
      this.jobProcessData.secondaryCollection.signatureUrl = this.secondaryCollectionSignatures[0].url;
    }
    if (this.jobProcessData.firstDelivery && this.firstDeliverySignatures[0]) {
      this.jobProcessData.firstDelivery.signatureUrl = this.firstDeliverySignatures[0].url;
    }

    // Optionally, sync damage images if your report generator supports them
    // e.g., this.jobProcessData.collection.damagePhotoUrls = this.damagePhotos.map(doc => doc.url);
    //       this.jobProcessData.collection.damageDiagramUrls = this.damageDiagrams.map(doc => doc.url);
  }

  // Generate document description based on filename and category
  private getDocumentDescription(fileName: string, category: string, type: string): string {
    const cleanName = fileName.replace(/\.(jpg|jpeg|png|pdf|gif)$/i, '');

    if (type === 'signature') {
      return `${category.replace('_', ' ')} signature`;
    }

    if (type === 'damage_diagram') {
      return `Damage diagram - ${cleanName}`;
    }

    // For photos, try to extract meaningful description
    if (cleanName.includes('front')) return `${category} - Front view`;
    if (cleanName.includes('rear')) return `${category} - Rear view`;
    if (cleanName.includes('left')) return `${category} - Left side`;
    if (cleanName.includes('right')) return `${category} - Right side`;
    if (cleanName.includes('interior')) return `${category} - Interior view`;
    if (cleanName.includes('damage')) return `${category} - Damage documentation`;

    return `${category.replace('_', ' ')} photo`;
  }

  // Tab selection
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    if (index === 5 && !this.jobBilling) {
      // Billing tab index (adjust if needed)
      this.loadBillingData();
    }
  }

  // Notes methods
  getFormattedNotes(notes?: JobNote[] | string | null | undefined): Array<{ content: string; authorName: string; createdAt: Date }> {
    if (!notes) return [];

    // Handle string notes (legacy format)
    if (typeof notes === 'string') {
      return [
        {
          content: notes,
          authorName: this.job?.createdBy || 'System',
          createdAt: Timestamp.now().toDate(),
        },
      ];
    }

    // Handle JobNote array format
    if (Array.isArray(notes)) {
      return notes.map((note) => ({
        content: note.content || note.text || '', // Handle different property names
        authorName: note.authorName || note.createdBy || 'System',
        createdAt: note.createdAt instanceof Timestamp ? note.createdAt.toDate() : note.createdAt instanceof Date ? note.createdAt : new Date(),
      }));
    }

    return [];
  }

  // Enhanced document viewing methods
  viewDocument(document: JobDocument): void {
    if (document.url) {
      window.open(document.url, '_blank');
    } else {
      this.showError('Document URL not available');
    }
  }

  downloadDocument(document: JobDocument): void {
    if (document.url) {
      window.open(document.url, '_blank');
    } else {
      this.showError('Document URL not available for download');
    }
  }

  // Get document counts for display
  getTotalDocumentCount(): number {
    return this.allDocuments.length;
  }

  getPhotoCount(): number {
    return this.allDocuments.filter((doc) => doc.type === 'photo').length;
  }

  getSignatureCount(): number {
    return this.allDocuments.filter((doc) => doc.type === 'signature').length;
  }

  getDamageDocumentCount(): number {
    return this.damagePhotos.length + this.damageDiagrams.length;
  }

  // Check if documents exist
  hasAnyDocuments(): boolean {
    // console.log('hasAnyDocuments', this.allDocuments);
    return this.allDocuments.length > 0;
  }

  hasCollectionDocuments(): boolean {
    return this.collectionPhotos.length > 0 || this.collectionSignatures.length > 0;
  }

  hasDeliveryDocuments(): boolean {
    return this.deliveryPhotos.length > 0 || this.deliverySignatures.length > 0;
  }

  hasDamageDocuments(): boolean {
    return this.damagePhotos.length > 0 || this.damageDiagrams.length > 0;
  }

  // Get damage severity color
  getDamageSeverityColor(severity: string): string {
    switch (severity) {
      case 'minor':
        return 'warn';
      case 'moderate':
        return 'accent';
      case 'severe':
        return 'warn';
      default:
        return 'primary';
    }
  }

  // Get damage severity icon
  getDamageSeverityIcon(severity: string): string {
    switch (severity) {
      case 'minor':
        return 'info';
      case 'moderate':
        return 'warning';
      case 'severe':
        return 'error';
      default:
        return 'help';
    }
  }

  // Format file size
  formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  // Billing Data Management
  private loadBillingData(): void {
    if (!this.job) return;

    this.isLoadingBilling = true;

    // TODO: Replace with actual Firebase service call
    setTimeout(() => {
      this.jobBilling = {
        basePrice: 150.0, // Initial job cost
        additionalItems: [],
        expenses: [],
        subtotal: 150.0,
        vatRate: 0.2,
        vatAmount: 30.0,
        totalAmount: 180.0,
        status: 'draft',
        notes: '',
        customerChargeableTotal: 150.0,
      };
      this.isLoadingBilling = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  // Update base price
  updateBasePrice(): void {
    if (!this.jobBilling) return;
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Base price updated');
  }

  // Add Expense
  addExpense(): void {
    if (!this.job || !this.currentUser || !this.newExpense.description || this.newExpense.amount <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }

    const expense: JobExpense = {
      id: `exp_${Date.now()}`,
      type: this.newExpense.type,
      description: this.newExpense.description,
      amount: this.newExpense.amount,
      liters: this.newExpense.type === 'fuel' ? this.newExpense.liters : undefined,
      date: Timestamp.now(),
      receiptUrl: this.newExpense.receiptUrl || undefined,
      addedBy: this.currentUser.id,
      addedByName: this.currentUser.name,
      isApproved: false,
      isChargeable: this.newExpense.isChargeable,
      notes: this.newExpense.notes || undefined,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.expenses.push(expense);
    this.calculateTotals();
    this.saveBillingData();

    // Reset form
    this.newExpense = {
      type: 'fuel',
      description: '',
      amount: 0,
      liters: 0,
      receiptUrl: '',
      isChargeable: true,
      notes: '',
    };

    this.showSuccess('Expense added successfully');
  }

  // Remove Expense
  removeExpense(expenseId: string): void {
    if (!this.jobBilling) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Remove Expense',
        message: 'Are you sure you want to remove this expense?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.jobBilling) {
        this.jobBilling.expenses = this.jobBilling.expenses.filter((exp) => exp.id !== expenseId);
        this.calculateTotals();
        this.saveBillingData();
        this.showSuccess('Expense removed');
      }
    });
  }

  // Add Standard Pricing Item
  addStandardPricingItem(item: any): void {
    const pricingItem: PricingItem = {
      id: `item_${Date.now()}`,
      name: item.name,
      description: item.description,
      price: item.price,
      quantity: 1,
      total: item.price,
      isCustom: false,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.additionalItems.push(pricingItem);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess(`${item.name} added to billing`);
  }

  // Add Pricing Item (matches existing method name)
  addPricingItem(): void {
    if (!this.newPricingItem.name || this.newPricingItem.price <= 0 || this.newPricingItem.quantity <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }

    const pricingItem: PricingItem = {
      id: `item_${Date.now()}`,
      name: this.newPricingItem.name,
      description: this.newPricingItem.description,
      price: this.newPricingItem.price,
      quantity: this.newPricingItem.quantity,
      total: this.newPricingItem.price * this.newPricingItem.quantity,
      isCustom: true,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.additionalItems.push(pricingItem);
    this.calculateTotals();
    this.saveBillingData();

    // Reset form
    this.newPricingItem = {
      name: '',
      description: '',
      price: 0,
      quantity: 1,
    };

    this.showSuccess('Custom item added to billing');
  }

  // Remove Pricing Item
  removePricingItem(itemId: string): void {
    if (!this.jobBilling) return;

    this.jobBilling.additionalItems = this.jobBilling.additionalItems.filter((item) => item.id !== itemId);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Item removed from billing');
  }

  // Calculate Totals
  private calculateTotals(): void {
    if (!this.jobBilling) return;

    // Calculate subtotal from base price and additional items
    const additionalItemsTotal = this.jobBilling.additionalItems.reduce((sum, item) => sum + item.total, 0);
    const chargeableExpensesTotal = this.jobBilling.expenses.filter((exp) => exp.isApproved && exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);

    this.jobBilling.subtotal = this.jobBilling.basePrice + additionalItemsTotal + chargeableExpensesTotal;

    // Calculate customer chargeable total (excluding non-chargeable expenses)
    this.jobBilling.customerChargeableTotal = this.jobBilling.basePrice + additionalItemsTotal + chargeableExpensesTotal;

    // Calculate VAT
    this.jobBilling.vatAmount = this.jobBilling.subtotal * this.jobBilling.vatRate;

    // Calculate total
    this.jobBilling.totalAmount = this.jobBilling.subtotal + this.jobBilling.vatAmount;
  }

  // Initialize Default Billing
  private initializeDefaultBilling(): void {
    this.jobBilling = {
      basePrice: 150.0,
      additionalItems: [],
      expenses: [],
      subtotal: 150.0,
      vatRate: 0.2,
      vatAmount: 30.0,
      totalAmount: 180.0,
      status: 'draft',
      customerChargeableTotal: 150.0,
    };
  }

  // Save Billing Data
  private saveBillingData(): void {
    if (!this.job || !this.jobBilling) return;

    // TODO: Implement actual save to Firebase
    console.log('Saving billing data:', this.jobBilling);
  }

  // Approve Expense
  approveExpense(expenseId: string): void {
    if (!this.jobBilling || !this.currentUser || !this.canManageBilling) return;

    const expense = this.jobBilling.expenses.find((exp) => exp.id === expenseId);
    if (expense) {
      expense.isApproved = true;
      expense.approvedBy = this.currentUser.id;
      expense.approvedAt = Timestamp.now();
      this.calculateTotals();
      this.saveBillingData();
      this.showSuccess('Expense approved');
    }
  }

  // Open receipt URL in new window
  openReceipt(receiptUrl: string): void {
    if (receiptUrl) {
      window.open(receiptUrl, '_blank');
    }
  }

  // Generate PDF Invoice
  generatePDFInvoice(): void {
    if (!this.job || !this.jobBilling) {
      this.showError('No billing data available to generate invoice');
      return;
    }

    // Generate invoice number if not exists
    if (!this.jobBilling.invoiceNumber) {
      this.jobBilling.invoiceNumber = `INV-${this.job.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      this.jobBilling.invoiceDate = Timestamp.now();
      this.jobBilling.dueDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      this.saveBillingData();
    }

    this.createPDFInvoice();
  }

  // Create PDF Invoice
  private createPDFInvoice(): void {
    const invoiceHTML = this.generateInvoiceHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    }
  }

  // Generate Invoice HTML
  private generateInvoiceHTML(): string {
    if (!this.job || !this.jobBilling) return '';

    const currentDate = new Date().toLocaleDateString('en-GB');
    const invoiceDate = this.jobBilling.invoiceDate?.toDate().toLocaleDateString('en-GB') || currentDate;
    const dueDate = this.jobBilling.dueDate?.toDate().toLocaleDateString('en-GB') || 'Net 30';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice ${this.jobBilling.invoiceNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .company-info { font-size: 14px; }
            .company-name { font-size: 24px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
            .invoice-details { text-align: right; }
            .invoice-title { font-size: 32px; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
            .invoice-meta { font-size: 14px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1e293b; }
            .customer-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .job-info { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f8fafc; font-weight: bold; color: #374151; }
            .amount { text-align: right; }
            .totals { margin-top: 30px; }
            .totals table { width: 50%; margin-left: auto; }
            .totals th, .totals td { border: none; padding: 8px 12px; }
            .total-row { font-weight: bold; font-size: 18px; background: #dbeafe; }
            .notes { margin-top: 30px; font-size: 14px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <div class="company-name">NI Vehicle Logistics Ltd.</div>
                <div>Northern Ireland</div>
                <div>United Kingdom</div>
                <div>Phone: +44 (0) 28 XXXX XXXX</div>
                <div>Email: info@nivehiclelogistics.com</div>
            </div>
            <div class="invoice-details">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-meta">
                    <div><strong>Invoice #:</strong> ${this.jobBilling.invoiceNumber}</div>
                    <div><strong>Date:</strong> ${invoiceDate}</div>
                    <div><strong>Due Date:</strong> ${dueDate}</div>
                    <div><strong>Job ID:</strong> ${this.job.id.substring(0, 8)}...</div>
                </div>
            </div>
        </div>

        <div class="customer-info">
            <div class="section-title">Bill To:</div>
            <div><strong>${this.job.customerName || 'Customer'}</strong></div>
            <div>${this.job.collectionAddress || ''}</div>
            <div>${this.job.collectionCity || ''} ${this.job.collectionPostcode || ''}</div>
        </div>

        <div class="job-info">
            <div class="section-title">Job Details:</div>
            <div><strong>Vehicle:</strong> ${this.job.vehicleRegistration} - ${this.job.vehicleMake || ''} ${this.job.vehicleModel || ''}</div>
            <div><strong>Service Type:</strong> ${this.job.isSplitJourney ? 'Split Journey' : 'Standard Collection & Delivery'}</div>
            <div><strong>Collection:</strong> ${this.job.collectionAddress}</div>
            <div><strong>Delivery:</strong> ${this.job.deliveryAddress}</div>
        </div>

        <div class="section-title">Services & Items:</div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th class="amount">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Base Service</td>
                    <td>1</td>
                    <td>£${this.jobBilling.basePrice.toFixed(2)}</td>
                    <td class="amount">£${this.jobBilling.basePrice.toFixed(2)}</td>
                </tr>
                ${this.jobBilling.additionalItems
                  .map(
                    (item) => `
                <tr>
                    <td>${item.name}<br><small>${item.description}</small></td>
                    <td>${item.quantity}</td>
                    <td>£${item.price.toFixed(2)}</td>
                    <td class="amount">£${item.total.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
                ${this.jobBilling.expenses
                  .filter((exp) => exp.isApproved && exp.isChargeable)
                  .map(
                    (expense) => `
                <tr>
                    <td>${expense.description} (${expense.type})</td>
                    <td>1</td>
                    <td>£${expense.amount.toFixed(2)}</td>
                    <td class="amount">£${expense.amount.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>

        <div class="totals">
            <table>
                <tr>
                    <th>Subtotal:</th>
                    <td class="amount">£${this.jobBilling.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <th>VAT (${(this.jobBilling.vatRate * 100).toFixed(0)}%):</th>
                    <td class="amount">£${this.jobBilling.vatAmount.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                    <th>TOTAL:</th>
                    <td class="amount">£${this.jobBilling.totalAmount.toFixed(2)}</td>
                </tr>
            </table>
        </div>

        ${
          this.jobBilling.notes
            ? `
        <div class="notes">
            <div class="section-title">Notes:</div>
            <p>${this.jobBilling.notes}</p>
        </div>
        `
            : ''
        }

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>Payment terms: Net 30 days | All prices include VAT where applicable</p>
        </div>
    </body>
    </html>
    `;
  }

  // Report generation methods
  canGenerateCollectionReport(): boolean {
    return this.job?.collectionData != null && this.job?.collectionData?.completedAt != null;
  }

  canGenerateSecondaryCollectionReport(): boolean {
    return this.job?.isSplitJourney === true && this.job?.secondaryCollectionData != null && this.job?.secondaryCollectionData?.completedAt != null;
  }

  canGenerateFirstDeliveryReport(): boolean {
    return this.job?.isSplitJourney === true && this.job?.firstDeliveryData != null && this.job?.firstDeliveryData?.completedAt != null;
  }

  canGenerateDeliveryReport(): boolean {
    return this.job?.deliveryData != null && this.job?.deliveryData?.completedAt != null;
  }

  // Utility to convert DOM image to data URL (base64)
  private async toDataURLFromDOM(img: HTMLImageElement): Promise<string> {
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth !== 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      } else {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
      }
    });
  }

  // Generate PDF from HTML report template, ensuring images are embedded as data URLs using DOM
  async generateHtmlPdfReport() {
    // Show loading spinner
    this.generatingReport = true;
    this.currentReportType = 'HTML PDF Report';

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      if (!this.job || !this.job.id) {
        throw new Error('No job found');
      }

      // List all images from different folders
      const photoPaths = [
        `jobs/${this.job.id}/collection_photos`,
        `jobs/${this.job.id}/delivery_photos`,
        `jobs/${this.job.id}/secondary_collection_photos`,
        `jobs/${this.job.id}/first_delivery_photos`,
        `jobs/${this.job.id}/collection_signatures`,
        `jobs/${this.job.id}/delivery_signatures`,
        `jobs/${this.job.id}/secondary_collection_signatures`,
        `jobs/${this.job.id}/first_delivery_signatures`,
        `jobs/${this.job.id}/damage_photos`,
        `jobs/${this.job.id}/damage_diagrams`,
      ];

      let allImages: any[] = [];

      // Get all images from all paths
      for (const path of photoPaths) {
        try {
          const files = await this.storageService.listFiles(path).toPromise();
          allImages = allImages.concat(files || []);
        } catch (error) {
          console.warn(`No files found in ${path}`);
        }
      }

      if (allImages.length === 0) {
        throw new Error('No images found for this job');
      }

      // Download and add each image to PDF
      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;

      for (let i = 0; i < allImages.length; i++) {
        const image = allImages[i];

        // Check if we need a new page
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = margin;
        }

        try {
          // Download image from Firebase as blob
          const response = await fetch(image.downloadUrl);
          if (!response.ok) {
            console.warn(`Failed to fetch image ${image.name}: ${response.statusText}`);
            continue;
          }

          const blob = await response.blob();

          // Convert blob to data URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Add image to PDF
          pdf.addImage(dataUrl, 'PNG', margin, yPosition, 40, 30);

          // Add image name below
          pdf.setFontSize(8);
          pdf.text(image.name, margin, yPosition + 35);

          yPosition += 50; // Move down for next image
        } catch (error) {
          console.warn(`Failed to process image ${image.name}:`, error);
        }
      }

      pdf.save(`Job_Report_${this.job.id}.pdf`);
      this.showSuccess(`PDF generated successfully with ${allImages.length} images`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.showError('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      // Hide loading spinner
      this.generatingReport = false;
      this.currentReportType = '';
    }
  }

  // For normal report generation, before passing image URLs to the report service, convert them to data URLs using the DOM if available
  private async convertAllDocumentImagesToDataUrls(): Promise<void> {
    // This will update allDocuments' url fields to data URLs if possible
    const tempDiv = document.createElement('div');
    document.body.appendChild(tempDiv);
    try {
      for (const doc of this.allDocuments) {
        if (doc.url && !doc.url.startsWith('data:')) {
          // Create a temporary img element
          const img = document.createElement('img');
          img.src = doc.url;
          tempDiv.appendChild(img);
          try {
            doc.url = await this.toDataURLFromDOM(img);
          } catch (e) {
            // fallback: leave as is
          }
          tempDiv.removeChild(img);
        }
      }
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  // Patch the report generation triggers to use data URLs for images
  async generateCollectionReport() {
    if (!this.job || !this.canGenerateCollectionReport()) return;
    await this.convertAllDocumentImagesToDataUrls();
    this.generatingReport = true;
    this.currentReportType = 'Collection (POC)';
    try {
      await this.reportGenerationService.generateCollectionReport(this.job);
      this.showSuccess('Collection report generated successfully');
    } catch (error) {
      console.error('Error generating collection report:', error);
      this.showError('Failed to generate collection report');
    } finally {
      this.generatingReport = false;
      this.currentReportType = '';
    }
  }

  async generateSecondaryCollectionReport() {
    if (!this.job || !this.canGenerateSecondaryCollectionReport()) return;
    await this.convertAllDocumentImagesToDataUrls();
    this.generatingReport = true;
    this.currentReportType = 'Secondary Collection (POC)';
    try {
      await this.reportGenerationService.generateSecondaryCollectionReport(this.job);
      this.showSuccess('Secondary collection report generated successfully');
    } catch (error) {
      console.error('Error generating secondary collection report:', error);
      this.showError('Failed to generate secondary collection report');
    } finally {
      this.generatingReport = false;
      this.currentReportType = '';
    }
  }

  async generateFirstDeliveryReport() {
    if (!this.job || !this.canGenerateFirstDeliveryReport()) return;
    await this.convertAllDocumentImagesToDataUrls();
    this.generatingReport = true;
    this.currentReportType = 'First Delivery (POD)';
    try {
      await this.reportGenerationService.generateFirstDeliveryReport(this.job);
      this.showSuccess('First delivery report generated successfully');
    } catch (error) {
      console.error('Error generating first delivery report:', error);
      this.showError('Failed to generate first delivery report');
    } finally {
      this.generatingReport = false;
      this.currentReportType = '';
    }
  }

  async generateDeliveryReport() {
    if (!this.job || !this.canGenerateDeliveryReport()) return;
    await this.convertAllDocumentImagesToDataUrls();
    this.generatingReport = true;
    this.currentReportType = 'Delivery (POD)';
    try {
      await this.reportGenerationService.generateDeliveryReport(this.job);
      this.showSuccess('Delivery report generated successfully');
    } catch (error) {
      console.error('Error generating delivery report:', error);
      this.showError('Failed to generate delivery report');
    } finally {
      this.generatingReport = false;
      this.currentReportType = '';
    }
  }

  // Utility methods
  getExpenseTypeLabel(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.label || type;
  }

  getExpenseTypeIcon(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.icon || 'receipt';
  }

  getExpenseTypeRequiresLiters(type: string): boolean {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.requiresLiters || false;
  }

  getTotalApprovedExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalPendingExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => !exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalChargeableExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved && exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalInternalExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved && !exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);
  }

  formatDate(date: Date | Timestamp | undefined): string {
    if (!date) return 'N/A';

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleDateString('en-GB');
    }

    if (date instanceof Date) {
      return date.toLocaleDateString('en-GB');
    }

    return new Date(date).toLocaleDateString('en-GB');
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  ///////////
  // Add these utility methods to your JobDetailsComponent class:

  getFullAddress(address?: string | null, city?: string | null, postcode?: string | null): string {
    const parts = [address, city, postcode].filter((part) => part && part.trim());
    return parts.length > 0 ? parts.join(', ') : 'Not specified';
  }

  getContactInfo(name?: string | null, phone?: string | null, email?: string | null): string {
    const parts = [];
    if (name) parts.push(name);
    if (phone) parts.push(phone);
    if (email) parts.push(email);
    return parts.length > 0 ? parts.join(' • ') : 'Not specified';
  }

  getVehicleInfo(): string {
    if (!this.job) return '';

    const parts = [];
    if (this.job.vehicleRegistration) parts.push(this.job.vehicleRegistration);
    if (this.job.vehicleMake) parts.push(this.job.vehicleMake);
    if (this.job.vehicleModel) parts.push(this.job.vehicleModel);

    return parts.length > 0 ? parts.join(' ') : 'Vehicle Details';
  }

  getVehicleSpecs(): Array<{ label: string; value: string }> {
    if (!this.job) return [];

    const specs = [];
    if (this.job.vehicleMake) specs.push({ label: 'Make', value: this.job.vehicleMake });
    if (this.job.vehicleModel) specs.push({ label: 'Model', value: this.job.vehicleModel });
    if (this.job.vehicleYear) specs.push({ label: 'Year', value: this.job.vehicleYear.toString() });
    if (this.job.vehicleColor) specs.push({ label: 'Color', value: this.job.vehicleColor });

    return specs;
  }

  formatDateTime(date: Date | Timestamp | undefined): string {
    if (!date) return 'N/A';

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleString('en-GB');
    }

    if (date instanceof Date) {
      return date.toLocaleString('en-GB');
    }

    return new Date(date).toLocaleString('en-GB');
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'unallocated':
        return 'warn';
      case 'allocated':
        return 'accent';
      case 'collected':
        return 'primary';
      case 'in-transit':
        return 'primary';
      case 'delivered':
        return 'primary';
      case 'completed':
        return 'primary';
      default:
        return 'accent';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'unallocated':
        return 'schedule';
      case 'allocated':
        return 'person';
      case 'collected':
        return 'local_shipping';
      case 'in-transit':
        return 'directions_car';
      case 'delivered':
        return 'flag';
      case 'completed':
        return 'check_circle';
      default:
        return 'info';
    }
  }

  getStatusProgress(): number {
    if (!this.job) return 0;

    switch (this.job.status) {
      case 'unallocated':
        return 10;
      case 'allocated':
        return 25;
      case 'collected':
        return 50;
      case 'in-transit':
        return 75;
      case 'delivered':
        return 90;
      case 'completed':
        return 100;
      default:
        return 0;
    }
  }

  get isStandardJourney(): boolean {
    return !this.job?.isSplitJourney;
  }

  get isSplitJourney(): boolean {
    return this.job?.isSplitJourney || false;
  }

  getJobTimeline(): any[] {
    return this.timelineEvents;
  }

  goBack(): void {
    this.router.navigate(['/jobs']);
  }

  editJob(): void {
    if (this.job) {
      this.router.navigate(['/jobs', this.job.id, 'edit']);
    }
  }

  refreshJob(): void {
    this.loadJob();
  }

  printJob(): void {
    window.print();
  }

  private extractProcessDocuments(processData: JobProcessData): void {
    if (!processData?.documents) return;

    // This method is now primarily handled by loadJobDocuments
    // Keep for backward compatibility with existing data structure
  }

  private generateTimelineEvents(): void {
    if (!this.job) return;

    this.timelineEvents = [];

    // Job created
    if (this.job.createdAt) {
      this.timelineEvents.push({
        type: 'created',
        title: 'Job Created',
        description: `Created by ${this.job.createdBy || 'System'}`,
        date: this.job.createdAt,
        icon: 'add_circle',
        color: 'primary',
      });
    }

    // Driver allocated
    if (this.job.allocatedAt && this.job.driverId) {
      this.timelineEvents.push({
        type: 'allocated',
        title: 'Driver Allocated',
        description: `Assigned to ${(this.job as any).driverName || 'Driver'}`,
        date: this.job.allocatedAt,
        icon: 'person_add',
        color: 'accent',
      });
    }

    // Collection process
    if (this.job.collectionActualStartTime) {
      this.timelineEvents.push({
        type: 'collection_started',
        title: 'Collection Started',
        description: 'Vehicle collection process began',
        date: this.job.collectionActualStartTime,
        icon: 'play_arrow',
        color: 'primary',
      });
    }

    if (this.job.collectionActualCompleteTime) {
      this.timelineEvents.push({
        type: 'collection_completed',
        title: 'Collection Completed',
        description: `Vehicle collected from ${this.job.collectionCity || 'pickup location'}`,
        date: this.job.collectionActualCompleteTime,
        icon: 'check_circle',
        color: 'success',
      });
    }

    // Split journey events
    if (this.job.isSplitJourney) {
      if (this.job.secondaryCollectionActualStartTime) {
        this.timelineEvents.push({
          type: 'secondary_collection_started',
          title: 'Secondary Collection Started',
          description: 'Secondary collection process began',
          date: this.job.secondaryCollectionActualStartTime,
          icon: 'play_arrow',
          color: 'primary',
        });
      }

      if (this.job.secondaryCollectionActualCompleteTime) {
        this.timelineEvents.push({
          type: 'secondary_collection_completed',
          title: 'Secondary Collection Completed',
          description: 'Secondary collection finished',
          date: this.job.secondaryCollectionActualCompleteTime,
          icon: 'check_circle',
          color: 'success',
        });
      }

      if (this.job.firstDeliveryActualStartTime) {
        this.timelineEvents.push({
          type: 'first_delivery_started',
          title: 'First Delivery Started',
          description: 'First delivery process began',
          date: this.job.firstDeliveryActualStartTime,
          icon: 'local_shipping',
          color: 'primary',
        });
      }

      if (this.job.firstDeliveryActualCompleteTime) {
        this.timelineEvents.push({
          type: 'first_delivery_completed',
          title: 'First Delivery Completed',
          description: 'First delivery finished',
          date: this.job.firstDeliveryActualCompleteTime,
          icon: 'check_circle',
          color: 'success',
        });
      }
    }

    // Final delivery
    if (this.job.deliveryActualStartTime) {
      this.timelineEvents.push({
        type: 'delivery_started',
        title: 'Delivery Started',
        description: 'Vehicle delivery process began',
        date: this.job.deliveryActualStartTime,
        icon: 'local_shipping',
        color: 'primary',
      });
    }

    if (this.job.deliveryActualCompleteTime) {
      this.timelineEvents.push({
        type: 'delivery_completed',
        title: 'Delivery Completed',
        description: `Vehicle delivered to ${this.job.deliveryCity || 'destination'}`,
        date: this.job.deliveryActualCompleteTime,
        icon: 'flag',
        color: 'success',
      });
    }

    // Sort events by date
    this.timelineEvents.sort((a, b) => {
      const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
      const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private formatJobNotes(): void {
    if (!this.job?.generalNotes) {
      this.formattedNotes = [];
      return;
    }

    if (Array.isArray(this.job.generalNotes)) {
      this.formattedNotes = this.job.generalNotes.map((note) => {
        if (typeof note === 'object' && note.content) {
          return {
            content: note.content,
            authorName: note.authorName || 'System',
            createdAt: note.createdAt || new Date(),
          };
        }
        return {
          content: note.toString(),
          authorName: 'System',
          createdAt: new Date(),
        };
      });
    }
  }

  getEnergyTypeLabel(energyType: string): string {
    if (!energyType) return 'Unknown';
    return energyType.charAt(0).toUpperCase() + energyType.slice(1).toLowerCase();
  }

  getEnergyLevelLabel(energyType: string): string {
    if (!energyType) return 'Level';
    return energyType.toLowerCase() === 'electric' ? 'Charge' : 'Fuel';
  }

  getMileageDifference(): number | null {
    const collectionMileage = this.vehicleCondition?.collection?.mileage;
    const deliveryMileage = this.vehicleCondition?.delivery?.mileage;

    if (collectionMileage !== undefined && deliveryMileage !== undefined) {
      return deliveryMileage - collectionMileage;
    }
    return null;
  }

  getEnergyUsed(): number | null {
    const collectionLevel = this.vehicleCondition?.collection?.fuelLevel;
    const deliveryLevel = this.vehicleCondition?.delivery?.fuelLevel;

    if (collectionLevel !== undefined && deliveryLevel !== undefined) {
      return collectionLevel - deliveryLevel;
    }
    return null;
  }

  // Legacy methods for backward compatibility
  viewPhoto(photo: ProcessPhoto | JobDocument): void {
    if ('url' in photo) {
      this.viewDocument(photo as JobDocument);
    } else {
      window.open((photo as ProcessPhoto).url, '_blank');
    }
  }

  downloadPhoto(photo: ProcessPhoto | JobDocument): void {
    if ('url' in photo && 'fileName' in photo) {
      this.downloadDocument(photo as JobDocument);
    } else {
      const link = document.createElement('a');
      link.href = (photo as ProcessPhoto).url;
      link.download = (photo as ProcessPhoto).fileName;
      link.click();
    }
  }

  viewSignature(signature: ProcessSignature): void {
    window.open(signature.url, '_blank');
  }

  downloadSignature(signature: ProcessSignature): void {
    const link = document.createElement('a');
    link.href = signature.url;
    link.download = `${signature.type}_signature_${signature.signerName}.png`;
    link.click();
  }
}
