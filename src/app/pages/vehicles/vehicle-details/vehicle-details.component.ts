import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

interface Dimensions {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
}

interface Weight {
  empty: number;
  maxLoad: number;
}

interface HandlingInstructions {
  loadingProcedure: string[];
  securingPoints: string[];
  specialConsiderations: string[];
  safetyRequirements: string[];
  equipment: string[];
}

interface Specifications {
  dimensions: Dimensions;
  weight: Weight;
  loadingRequirements: string[];
  transportRestrictions: string[];
  requiredEquipment: string[];
}

interface Document {
  name: string;
  type: string;
  url: string;
  lastUpdated: Date;
}

interface JobHistory {
  jobId: string;
  date: Date;
  customer: string;
  distance: number;
  duration: number;
  issues: string[];
}

interface VehicleModel {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  name: string;
  yearStart: number;
  yearEnd: number | null;
  images: string[];
  specifications: Specifications;
  handlingInstructions: HandlingInstructions;
  documents: Document[];
  jobHistory: JobHistory[];
  status: 'Active' | 'Archived';
  activeJobs: number;
}

type TabType = 'overview' | 'specifications' | 'handling' | 'history';

@Component({
  selector: 'app-vehicle-details',
  templateUrl: './vehicle-details.component.html',
  styleUrls: ['./vehicle-details.component.scss'],
  standalone: false,
})
export class VehicleDetailsComponent implements OnInit {
  model: VehicleModel | null = null;
  activeTab: TabType = 'overview';
  currentImageIndex = 0;
  isAdmin = true; // For demo purposes
  loading = true;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const modelId = params['id'];
      if (modelId) {
        this.loadModelDetails(modelId);
      }
    });
  }

  loadModelDetails(modelId: string): void {
    this.loading = true;
    this.error = null;

    // Simulate API delay
    setTimeout(() => {
      try {
        // Return same dummy data regardless of ID
        this.model = {
          id: modelId,
          manufacturerId: '1',
          manufacturerName: 'Toyota',
          name: 'Corolla',
          yearStart: 2018,
          yearEnd: null,
          status: 'Active',
          activeJobs: 5,
          images: [
            '/assets/images/corolla.jpg',
            '/assets/images/corolla1.jpg',
            '/assets/images/corolla2.jpg',
          ],
          specifications: {
            dimensions: {
              length: 192.7,
              width: 72.4,
              height: 56.9,
              wheelbase: 111.2,
            },
            weight: {
              empty: 3310,
              maxLoad: 4500,
            },
            loadingRequirements: [
              'Clear overhead clearance of 7 feet',
              'Minimum ramp angle of 10 degrees',
              'Secure all loose items',
            ],
            transportRestrictions: [
              'No stacking',
              'Climate controlled transport recommended',
            ],
            requiredEquipment: [
              'Wheel straps',
              'Soft tie-downs',
              'Wheel chocks',
            ],
          },
          handlingInstructions: {
            loadingProcedure: [
              'Inspect vehicle for existing damage',
              'Position vehicle straight with loading ramp',
              'Drive slowly onto transport',
              'Set parking brake',
            ],
            securingPoints: [
              'Front tow hooks',
              'Rear tow hooks',
              'Wheel straps',
            ],
            specialConsiderations: [
              'Low ground clearance',
              'Sport suspension package available',
            ],
            safetyRequirements: [
              'Use wheel chocks',
              'Verify tie-down tension',
              'Check ground clearance',
            ],
            equipment: [
              'Wheel straps',
              'Soft tie-downs',
              'Wheel chocks',
              'Loading ramps',
            ],
          },
          documents: [
            {
              name: 'Loading Guidelines',
              type: 'PDF',
              url: '/documents/loading-guidelines.pdf',
              lastUpdated: new Date('2024-01-15'),
            },
            {
              name: 'Safety Protocol',
              type: 'PDF',
              url: '/documents/safety-protocol.pdf',
              lastUpdated: new Date('2024-01-15'),
            },
          ],
          jobHistory: [
            {
              jobId: 'J123',
              date: new Date('2024-01-10'),
              customer: 'ABC Motors',
              distance: 450,
              duration: 8,
              issues: ['Minor delay due to weather'],
            },
            {
              jobId: 'J124',
              date: new Date('2024-01-15'),
              customer: 'XYZ Transport',
              distance: 300,
              duration: 6,
              issues: [],
            },
          ],
        };
        this.loading = false;
      } catch (error) {
        this.error = 'Failed to load model details';
        this.loading = false;
      }
    }, 1000); // Simulate network delay
  }

  get currentImage(): string {
    return this.model?.images[this.currentImageIndex] || '';
  }

  get hasImages(): boolean {
    return (this.model?.images?.length || 0) > 0;
  }

  get totalImages(): number {
    return this.model?.images?.length || 0;
  }

  get averageTransportTime(): number {
    if (!this.model?.jobHistory.length) return 0;
    const total = this.model.jobHistory.reduce(
      (sum, job) => sum + job.duration,
      0
    );
    return Math.round((total / this.model.jobHistory.length) * 10) / 10;
  }

  get totalJobs(): number {
    return this.model?.jobHistory?.length || 0;
  }

  nextImage(): void {
    if (this.model?.images.length) {
      this.currentImageIndex =
        (this.currentImageIndex + 1) % this.model.images.length;
    }
  }

  previousImage(): void {
    if (this.model?.images.length) {
      this.currentImageIndex =
        this.currentImageIndex === 0
          ? this.model.images.length - 1
          : this.currentImageIndex - 1;
    }
  }

  switchTab(tab: TabType): void {
    this.activeTab = tab;
  }

  archiveModel(): void {
    if (!this.model) return;
    // TODO: Implement archive functionality
    console.log(`Archiving model: ${this.model.id}`);
  }

  downloadDocument(doc: Document): void {
    // TODO: Implement document download
    console.log(`Downloading document: ${doc.name}`);
  }

  getSpecificationList(type: keyof Specifications): string[] {
    return (this.model?.specifications[type] as string[]) || [];
  }

  getHandlingInstructionList(type: keyof HandlingInstructions): string[] {
    return this.model?.handlingInstructions[type] || [];
  }
}
