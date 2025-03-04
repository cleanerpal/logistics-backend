import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

interface Document {
  id: string;
  name: string;
  description: string;
  dateAdded: Date;
  url: string;
  type: 'pdf' | 'doc' | 'image';
  fileSize?: string;
}

interface InspectionPoint {
  id: string;
  label: string;
  position: {
    x: number;
    y: number;
  };
  hasIssue: boolean;
  condition: string;
  notes: string;
  images: PhotoImage[];
  severity: 'low' | 'medium' | 'high';
  dateAdded: Date;
  addedBy: string;
}

interface PhotoImage {
  id: string;
  url: string;
}

interface Job {
  id: string;
  status: 'unallocated' | 'in-progress' | 'completed' | 'cancelled';
  currentDriver?: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    company: string;
  };
  vehicle: {
    make: string;
    model: string;
    year: number;
    registration: string;
    color: string;
    shippingRef: string;
  };
  addresses: {
    collection: {
      street: string;
      city: string;
      postcode: string;
      instructions: string;
    };
    delivery: {
      street: string;
      city: string;
      postcode: string;
      instructions: string;
    };
  };
  driver: {
    name: string;
    phone: string;
    currentLocation: string;
    assignedDate: Date;
  };
  currentTeam: {
    primaryDriver: {
      name: string;
      phone: string;
      role: string;
      since: Date;
    };
    additionalStaff?: {
      name: string;
      phone: string;
      role: string;
      since: Date;
    }[];
  };
  timeline: {
    date: Date;
    status: string;
    description: string;
  }[];
  documents?: Document[];
  inspectionPoints?: { [key: string]: InspectionPoint[] };
  additionalPhotos?: PhotoImage[];
}

@Component({
  selector: 'app-job-details',
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
})
export class JobDetailsComponent implements OnInit {
  jobId: string = '';
  activeTab: 'details' | 'timeline' | 'documents' = 'details';
  currentView: 'front' | 'rear' | 'left' | 'right' = 'front';
  selectedPoint: InspectionPoint | null = null;
  selectedImage: PhotoImage | null = null;
  isImageViewerOpen: boolean = false;

  job: Job;

  officialDocuments: Document[] = [
    {
      id: 'doc1',
      name: 'Collection Form',
      description: 'Vehicle collection documentation and sign-off',
      dateAdded: new Date(),
      url: '/assets/docs/collection.pdf',
      type: 'pdf',
      fileSize: '1.2 MB',
    },
    {
      id: 'doc2',
      name: 'Inspection Report',
      description: 'Pre-transport vehicle condition report',
      dateAdded: new Date(),
      url: '/assets/docs/inspection.pdf',
      type: 'pdf',
      fileSize: '2.8 MB',
    },
    {
      id: 'doc3',
      name: 'Transport Agreement',
      description: 'Signed transport agreement and terms',
      dateAdded: new Date(),
      url: '/assets/docs/agreement.pdf',
      type: 'pdf',
      fileSize: '523 KB',
    },
  ];

  inspectionPoints: { [key: string]: InspectionPoint[] } = {
    front: [
      {
        id: 'f1',
        label: 'Front Bumper',
        position: { x: 50, y: 80 },
        hasIssue: true,
        condition: 'Minor scratch on front bumper',
        notes: 'Surface level scratch, approximately 15cm long',
        severity: 'low',
        dateAdded: new Date(),
        addedBy: 'John Smith',
        images: [
          {
            id: 'img1',
            url: '/assets/images/damage/1.jpg',
          },
        ],
      },
      {
        id: 'f2',
        label: 'Headlight',
        position: { x: 35, y: 65 },
        hasIssue: false,
        condition: 'Good condition',
        notes: 'No visible damage or issues',
        severity: 'low',
        dateAdded: new Date(),
        addedBy: 'John Smith',
        images: [],
      },
    ],
    rear: [
      {
        id: 'r1',
        label: 'Rear Bumper',
        position: { x: 50, y: 85 },
        hasIssue: false,
        condition: 'Good condition',
        notes: 'No visible damage',
        severity: 'low',
        dateAdded: new Date(),
        addedBy: 'John Smith',
        images: [],
      },
    ],
    left: [
      {
        id: 'l1',
        label: 'Left Door',
        position: { x: 45, y: 50 },
        hasIssue: true,
        condition: 'Minor dent',
        notes: "Small dent on driver's door",
        severity: 'medium',
        dateAdded: new Date(),
        addedBy: 'John Smith',
        images: [
          {
            id: 'img2',
            url: '/assets/images/damage/2.jpg',
          },
        ],
      },
    ],
    right: [],
  };

  additionalPhotos: PhotoImage[] = [
    {
      id: 'add1',
      url: '/assets/images/damage/1.jpg',
    },
    {
      id: 'add2',
      url: '/assets/images/damage/2.jpg',
    },
  ];

  constructor(private route: ActivatedRoute) {
    // Initialize with base job data...
    this.job = {
      id: 'JOB0001',
      status: 'in-progress',
      currentDriver: 'Dave Wilson',
      customer: {
        name: 'John Smith',
        phone: '+44 123 456 7890',
        email: 'john.smith@email.com',
        company: 'Smith Enterprises',
      },
      vehicle: {
        make: 'Toyota',
        model: 'Corolla',
        year: 2022,
        registration: 'AB12 CDE',
        color: 'Silver',
        shippingRef: '1234FGH',
      },
      addresses: {
        collection: {
          street: '123 Collection St',
          city: 'London',
          postcode: 'SW1A 1AA',
          instructions: 'NOTES GO HERE',
        },
        delivery: {
          street: '456 Delivery Rd',
          city: 'Belfast',
          postcode: 'BT16 1WP',
          instructions: 'NOTES GO HERE',
        },
      },
      driver: {
        name: 'Mike Johnson',
        phone: '+44 987 654 3210',
        currentLocation: 'En route to delivery',
        assignedDate: new Date(),
      },
      currentTeam: {
        primaryDriver: {
          name: 'Dave Wilson',
          phone: '+44 777 888 9999',
          role: 'Primary Driver',
          since: new Date(Date.now() - 2 * 3600000),
        },
        additionalStaff: [
          {
            name: 'Sarah Palmer',
            phone: '+44 777 666 5555',
            role: 'Support Driver',
            since: new Date(Date.now() - 2 * 3600000),
          },
        ],
      },
      timeline: [
        {
          date: new Date(),
          status: 'In Transit',
          description:
            'Vehicle handed over to Dave Wilson for second leg of journey. Currently 120 miles from delivery location.',
        },
        {
          date: new Date(Date.now() - 2 * 3600000),
          status: 'Driver Change',
          description:
            'Scheduled driver change at Manchester depot. Mike Johnson completed first leg (186 miles).',
        },
        {
          date: new Date(Date.now() - 5 * 3600000),
          status: 'In Transit',
          description:
            'Journey commenced with Mike Johnson and Tom Harris. Estimated total journey time: 7 hours.',
        },
        {
          date: new Date(Date.now() - 6 * 3600000),
          status: 'Collection',
          description:
            'Vehicle collected from customer. All paperwork completed and verified.',
        },
        {
          date: new Date(Date.now() - 24 * 3600000),
          status: 'Assigned',
          description:
            'Job assigned to Mike Johnson as lead driver. Long-distance route planned with driver change.',
        },
      ],
    };
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      // In real app, fetch job details here
      this.loadJobDetails(this.jobId);
    });
  }

  loadJobDetails(jobId: string) {
    // API call to fetch job details
    // For now, using dummy data
    console.log(`Loading details for job ${jobId}`);
  }

  setActiveTab(tab: 'details' | 'timeline' | 'documents') {
    this.activeTab = tab;
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      unallocated: 'status-red',
      'in-progress': 'status-orange',
      completed: 'status-green',
      cancelled: 'status-gray',
    };
    return statusMap[status] || '';
  }

  getTimelineIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'In Transit': 'local_shipping',
      'Driver Change': 'people',
      Collection: 'location_on',
      Assigned: 'assignment_turned_in',
      Completed: 'check_circle',
      Cancelled: 'cancel',
    };
    return iconMap[status] || 'radio_button_unchecked';
  }

  setVehicleView(view: 'front' | 'rear' | 'left' | 'right') {
    this.currentView = view;
    this.selectedPoint = null;
  }

  getCurrentViewImage(): string {
    return `/assets/images/vehicle-${this.currentView}.png`;
  }

  getViewPoints(): InspectionPoint[] {
    return this.inspectionPoints[this.currentView] || [];
  }

  showInspectionDetail(point: InspectionPoint) {
    this.selectedPoint = point;
  }

  async downloadDocument(doc: Document) {
    try {
      // In a real application, you would:
      // 1. Make an API call to get the document
      // 2. Handle the blob response
      // 3. Create a download link
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Handle error (show notification, etc.)
    }
  }

  openImageViewer(image: PhotoImage) {
    this.selectedImage = image;
    this.isImageViewerOpen = true;
  }

  closeImageViewer() {
    this.selectedImage = null;
    this.isImageViewerOpen = false;
  }

  isLastEvent(event: any): boolean {
    return this.job.timeline.indexOf(event) === this.job.timeline.length - 1;
  }

  getSeverityClass(severity: string): string {
    const severityMap: { [key: string]: string } = {
      low: 'severity-low',
      medium: 'severity-medium',
      high: 'severity-high',
    };
    return severityMap[severity] || '';
  }

  // Helper method to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Method to handle image upload
  async uploadImage(event: Event, pointId?: string) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      console.error('Please upload an image file');
      return;
    }

    try {
      // Here you would typically:
      // 1. Create a FormData object
      // 2. Send to your API
      // 3. Update the UI with the new image
      console.log('Uploading image...', file.name);
      // Implement your upload logic
    } catch (error) {
      console.error('Error uploading image:', error);
      // Handle error (show notification, etc.)
    }
  }
}
