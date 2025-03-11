import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  TemplateRef,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatCheckboxChange } from '@angular/material/checkbox';

interface Manufacturer {
  id: string;
  name: string;
  logoUrl: string;
  modelCount: number;
  activeJobs: number;
  lastUpdated: Date;
  isActive: boolean;
}

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.scss',
})
export class VehicleListComponent implements OnInit, AfterViewInit {
  // Data source and pagination
  dataSource = new MatTableDataSource<Manufacturer>([]);
  allManufacturers: Manufacturer[] = [];
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Search and sort
  searchTerm = '';
  sortOption: 'alphabetical' | 'mostUsed' | 'recent' = 'alphabetical';
  showInactive = false;

  // Loading and admin states
  isLoading = false;
  isAdmin = false; // Should be set by auth service

  // Stats
  totalModels = 0;

  // Form
  manufacturerForm: FormGroup;

  // Dialog state
  dialogData: Manufacturer | null = null;
  manufacturerToDelete: Manufacturer | null = null;

  // Template References
  @ViewChild('addManufacturerDialog')
  addManufacturerDialog!: TemplateRef<any>;

  @ViewChild('deleteConfirmDialog')
  deleteConfirmDialog!: TemplateRef<any>;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.manufacturerForm = this.formBuilder.group({
      name: ['', Validators.required],
      logoUrl: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.loadManufacturers();
    this.setupCustomFilter();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private setupCustomFilter() {
    this.dataSource.filterPredicate = (data: Manufacturer, filter: string) => {
      // Check if we should show the item based on active status
      if (!data.isActive && !this.showInactive) {
        return false;
      }

      // If there's no search filter, show the item
      if (!filter) {
        return true;
      }

      // Apply the search filter
      const searchStr = filter.toLowerCase();
      return (
        data.name.toLowerCase().includes(searchStr) ||
        data.modelCount.toString().includes(searchStr) ||
        data.activeJobs.toString().includes(searchStr)
      );
    };
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  toggleShowInactive(event: MatSlideToggleChange) {
    this.showInactive = event.checked;

    // Force a refresh of the filtered data
    const currentFilter = this.dataSource.filter;
    this.dataSource.filter = ''; // Clear filter
    this.dataSource.filter = currentFilter; // Reapply filter

    // If we're showing inactive items, make sure we have all data available
    if (this.showInactive) {
      // Restore any filtered out inactive items
      this.dataSource.data = [...this.allManufacturers];
    }
  }

  toggleManufacturerActive(
    manufacturer: Manufacturer,
    event: MatCheckboxChange
  ) {
    manufacturer.isActive = event.checked;

    // Update the manufacturer in the allManufacturers array
    const index = this.allManufacturers.findIndex(
      (m) => m.id === manufacturer.id
    );
    if (index !== -1) {
      this.allManufacturers[index].isActive = event.checked;
    }

    // If manufacturer is being deactivated and show inactive is false,
    // update the visible data
    if (!manufacturer.isActive && !this.showInactive) {
      this.dataSource.data = this.dataSource.data.filter(
        (m) => m.id !== manufacturer.id
      );
    }

    // Force filter refresh
    const currentFilter = this.dataSource.filter || '';
    this.dataSource.filter = '';
    this.dataSource.filter = currentFilter;

    // Show success message
    this.showSuccessMessage(
      `${manufacturer.name} ${
        manufacturer.isActive ? 'activated' : 'deactivated'
      } successfully`
    );

    // Here you would typically make an API call to update the status
  }

  loadManufacturers() {
    this.isLoading = true;

    // Simulate API call
    setTimeout(() => {
      this.allManufacturers = [
        {
          id: '1',
          name: 'Abarth',
          logoUrl: '/assets/images/car-logos/abarth.jpg',
          modelCount: 42,
          activeJobs: 25,
          lastUpdated: new Date('2025-01-30T13:34:46.045172'),
          isActive: true,
        },
        {
          id: '2',
          name: 'AC',
          logoUrl: '/assets/images/car-logos/ac.jpg',
          modelCount: 16,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045184'),
          isActive: true,
        },
        {
          id: '3',
          name: 'Aixam',
          logoUrl: '/assets/images/car-logos/aixam.jpg',
          modelCount: 26,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045189'),
          isActive: true,
        },
        {
          id: '4',
          name: 'Alfa Romeo',
          logoUrl: '/assets/images/car-logos/alfa_romeo.jpg',
          modelCount: 9,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045192'),
          isActive: true,
        },
        {
          id: '5',
          name: 'Alpine',
          logoUrl: '/assets/images/car-logos/alpine.jpg',
          modelCount: 5,
          activeJobs: 19,
          lastUpdated: new Date('2025-01-30T13:34:46.045195'),
          isActive: true,
        },
        {
          id: '6',
          name: 'Ariel',
          logoUrl: '/assets/images/car-logos/ariel.jpg',
          modelCount: 42,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045198'),
          isActive: true,
        },
        {
          id: '7',
          name: 'Aston Martin',
          logoUrl: '/assets/images/car-logos/aston_martin.jpg',
          modelCount: 24,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045202'),
          isActive: true,
        },
        {
          id: '8',
          name: 'Audi',
          logoUrl: '/assets/images/car-logos/audi.jpg',
          modelCount: 46,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045205'),
          isActive: true,
        },
        {
          id: '9',
          name: 'Austin',
          logoUrl: '/assets/images/car-logos/austin.jpg',
          modelCount: 12,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045207'),
          isActive: true,
        },
        {
          id: '10',
          name: 'BAC',
          logoUrl: '/assets/images/car-logos/bac.jpg',
          modelCount: 26,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045210'),
          isActive: true,
        },
        {
          id: '11',
          name: 'Bentley',
          logoUrl: '/assets/images/car-logos/bentley.jpg',
          modelCount: 12,
          activeJobs: 16,
          lastUpdated: new Date('2025-01-30T13:34:46.045213'),
          isActive: true,
        },
        {
          id: '12',
          name: 'BMW',
          logoUrl: '/assets/images/car-logos/bmw.jpg',
          modelCount: 39,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045216'),
          isActive: true,
        },
        {
          id: '13',
          name: 'Bmw-bikes',
          logoUrl: '/assets/images/car-logos/bmw-bikes.jpg',
          modelCount: 25,
          activeJobs: 7,
          lastUpdated: new Date('2025-01-30T13:34:46.045219'),
          isActive: true,
        },
        {
          id: '14',
          name: 'Bobcat',
          logoUrl: '/assets/images/car-logos/bobcat.jpg',
          modelCount: 10,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045222'),
          isActive: true,
        },
        {
          id: '15',
          name: 'Bowler',
          logoUrl: '/assets/images/car-logos/bowler.jpg',
          modelCount: 12,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045224'),
          isActive: true,
        },
        {
          id: '16',
          name: 'Bugatti',
          logoUrl: '/assets/images/car-logos/bugatti.jpg',
          modelCount: 47,
          activeJobs: 7,
          lastUpdated: new Date('2025-01-30T13:34:46.045227'),
          isActive: true,
        },
        {
          id: '17',
          name: 'Buick',
          logoUrl: '/assets/images/car-logos/buick.jpg',
          modelCount: 38,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045230'),
          isActive: true,
        },
        {
          id: '18',
          name: 'BYD',
          logoUrl: '/assets/images/car-logos/byd.jpg',
          modelCount: 38,
          activeJobs: 7,
          lastUpdated: new Date('2025-01-30T13:34:46.045233'),
          isActive: true,
        },
        {
          id: '19',
          name: 'Cadillac',
          logoUrl: '/assets/images/car-logos/cadillac.jpg',
          modelCount: 16,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045236'),
          isActive: true,
        },
        {
          id: '20',
          name: 'Case',
          logoUrl: '/assets/images/car-logos/case.jpg',
          modelCount: 22,
          activeJobs: 9,
          lastUpdated: new Date('2025-01-30T13:34:46.045238'),
          isActive: true,
        },
        {
          id: '21',
          name: 'Caterham',
          logoUrl: '/assets/images/car-logos/caterham.jpg',
          modelCount: 9,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045241'),
          isActive: true,
        },
        {
          id: '22',
          name: 'Caterpillar',
          logoUrl: '/assets/images/car-logos/caterpillar.jpg',
          modelCount: 41,
          activeJobs: 9,
          lastUpdated: new Date('2025-01-30T13:34:46.045244'),
          isActive: true,
        },
        {
          id: '23',
          name: 'Chevrolet',
          logoUrl: '/assets/images/car-logos/chevrolet.jpg',
          modelCount: 41,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045246'),
          isActive: true,
        },
        {
          id: '24',
          name: 'Chrysler',
          logoUrl: '/assets/images/car-logos/chrysler.jpg',
          modelCount: 48,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045249'),
          isActive: true,
        },
        {
          id: '25',
          name: 'Citroen',
          logoUrl: '/assets/images/car-logos/citroen.jpg',
          modelCount: 28,
          activeJobs: 19,
          lastUpdated: new Date('2025-01-30T13:34:46.045252'),
          isActive: true,
        },
        {
          id: '26',
          name: 'Corvette',
          logoUrl: '/assets/images/car-logos/corvette.jpg',
          modelCount: 50,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045254'),
          isActive: true,
        },
        {
          id: '27',
          name: 'CUPRA',
          logoUrl: '/assets/images/car-logos/cupra.jpg',
          modelCount: 38,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045257'),
          isActive: true,
        },
        {
          id: '28',
          name: 'Dacia',
          logoUrl: '/assets/images/car-logos/dacia.jpg',
          modelCount: 5,
          activeJobs: 12,
          lastUpdated: new Date('2025-01-30T13:34:46.045260'),
          isActive: true,
        },
        {
          id: '29',
          name: 'Daewoo',
          logoUrl: '/assets/images/car-logos/daewoo.jpg',
          modelCount: 11,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045263'),
          isActive: true,
        },
        {
          id: '30',
          name: 'Daihatsu',
          logoUrl: '/assets/images/car-logos/daihatsu.jpg',
          modelCount: 43,
          activeJobs: 0,
          lastUpdated: new Date('2025-01-30T13:34:46.045265'),
          isActive: true,
        },
        {
          id: '31',
          name: 'Daimler',
          logoUrl: '/assets/images/car-logos/daimler.jpg',
          modelCount: 26,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045268'),
          isActive: true,
        },
        {
          id: '32',
          name: 'Datsun',
          logoUrl: '/assets/images/car-logos/datsun.jpg',
          modelCount: 27,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045270'),
          isActive: true,
        },
        {
          id: '33',
          name: 'DFSK',
          logoUrl: '/assets/images/car-logos/dfsk.jpg',
          modelCount: 26,
          activeJobs: 9,
          lastUpdated: new Date('2025-01-30T13:34:46.045273'),
          isActive: true,
        },
        {
          id: '34',
          name: 'Dodge',
          logoUrl: '/assets/images/car-logos/dodge.jpg',
          modelCount: 25,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045276'),
          isActive: true,
        },
        {
          id: '35',
          name: 'DS Automobiles',
          logoUrl: '/assets/images/car-logos/ds_automobiles.jpg',
          modelCount: 15,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045281'),
          isActive: true,
        },
        {
          id: '36',
          name: 'Ducati',
          logoUrl: '/assets/images/car-logos/ducati.jpg',
          modelCount: 15,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045283'),
          isActive: true,
        },
        {
          id: '37',
          name: 'Ferrari',
          logoUrl: '/assets/images/car-logos/ferrari.jpg',
          modelCount: 22,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045286'),
          isActive: true,
        },
        {
          id: '38',
          name: 'Fiat',
          logoUrl: '/assets/images/car-logos/fiat.jpg',
          modelCount: 19,
          activeJobs: 16,
          lastUpdated: new Date('2025-01-30T13:34:46.045289'),
          isActive: true,
        },
        {
          id: '39',
          name: 'Fiat-vans',
          logoUrl: '/assets/images/car-logos/fiat-vans.jpg',
          modelCount: 26,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045291'),
          isActive: true,
        },
        {
          id: '40',
          name: 'Ford',
          logoUrl: '/assets/images/car-logos/ford.jpg',
          modelCount: 41,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045294'),
          isActive: true,
        },
        {
          id: '41',
          name: 'Ford-vans',
          logoUrl: '/assets/images/car-logos/ford-vans.jpg',
          modelCount: 16,
          activeJobs: 15,
          lastUpdated: new Date('2025-01-30T13:34:46.045297'),
          isActive: true,
        },
        {
          id: '42',
          name: 'Genesis',
          logoUrl: '/assets/images/car-logos/genesis.jpg',
          modelCount: 21,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045299'),
          isActive: true,
        },
        {
          id: '43',
          name: 'GMC',
          logoUrl: '/assets/images/car-logos/gmc.jpg',
          modelCount: 39,
          activeJobs: 22,
          lastUpdated: new Date('2025-01-30T13:34:46.045302'),
          isActive: true,
        },
        {
          id: '44',
          name: 'Great Wall',
          logoUrl: '/assets/images/car-logos/great_wall.jpg',
          modelCount: 30,
          activeJobs: 2,
          lastUpdated: new Date('2025-01-30T13:34:46.045305'),
          isActive: true,
        },
        {
          id: '45',
          name: 'GWM ORA',
          logoUrl: '/assets/images/car-logos/gwm_ora.jpg',
          modelCount: 35,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045308'),
          isActive: true,
        },
        {
          id: '46',
          name: 'Harley-Davidson',
          logoUrl: '/assets/images/car-logos/harley-davidson.jpg',
          modelCount: 50,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045310'),
          isActive: true,
        },
        {
          id: '47',
          name: 'Hillman',
          logoUrl: '/assets/images/car-logos/hillman.jpg',
          modelCount: 19,
          activeJobs: 17,
          lastUpdated: new Date('2025-01-30T13:34:46.045313'),
          isActive: true,
        },
        {
          id: '48',
          name: 'Hitachi',
          logoUrl: '/assets/images/car-logos/hitachi.jpg',
          modelCount: 9,
          activeJobs: 24,
          lastUpdated: new Date('2025-01-30T13:34:46.045315'),
          isActive: true,
        },
        {
          id: '49',
          name: 'Honda',
          logoUrl: '/assets/images/car-logos/honda.jpg',
          modelCount: 42,
          activeJobs: 22,
          lastUpdated: new Date('2025-01-30T13:34:46.045318'),
          isActive: true,
        },
        {
          id: '50',
          name: 'Hummer',
          logoUrl: '/assets/images/car-logos/hummer.jpg',
          modelCount: 8,
          activeJobs: 14,
          lastUpdated: new Date('2025-01-30T13:34:46.045321'),
          isActive: true,
        },
        {
          id: '51',
          name: 'Hyundai',
          logoUrl: '/assets/images/car-logos/hyundai.jpg',
          modelCount: 36,
          activeJobs: 17,
          lastUpdated: new Date('2025-01-30T13:34:46.045323'),
          isActive: true,
        },
        {
          id: '52',
          name: 'Ifor-williams',
          logoUrl: '/assets/images/car-logos/ifor-williams.jpg',
          modelCount: 31,
          activeJobs: 19,
          lastUpdated: new Date('2025-01-30T13:34:46.045328'),
          isActive: true,
        },
        {
          id: '53',
          name: 'Infiniti',
          logoUrl: '/assets/images/car-logos/infiniti.jpg',
          modelCount: 39,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045331'),
          isActive: true,
        },
        {
          id: '54',
          name: 'Isuzu',
          logoUrl: '/assets/images/car-logos/isuzu.jpg',
          modelCount: 8,
          activeJobs: 0,
          lastUpdated: new Date('2025-01-30T13:34:46.045334'),
          isActive: true,
        },
        {
          id: '55',
          name: 'Isuzu-vans',
          logoUrl: '/assets/images/car-logos/isuzu-vans.jpg',
          modelCount: 6,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045336'),
          isActive: true,
        },
        {
          id: '56',
          name: 'Iveco',
          logoUrl: '/assets/images/car-logos/iveco.jpg',
          modelCount: 29,
          activeJobs: 14,
          lastUpdated: new Date('2025-01-30T13:34:46.045339'),
          isActive: true,
        },
        {
          id: '57',
          name: 'Jaecoo',
          logoUrl: '/assets/images/car-logos/jaecoo.jpg',
          modelCount: 24,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045342'),
          isActive: true,
        },
        {
          id: '58',
          name: 'Jaguar',
          logoUrl: '/assets/images/car-logos/jaguar.jpg',
          modelCount: 44,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045344'),
          isActive: true,
        },
        {
          id: '59',
          name: 'JCB',
          logoUrl: '/assets/images/car-logos/jcb.jpg',
          modelCount: 8,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045347'),
          isActive: true,
        },
        {
          id: '60',
          name: 'Jeep',
          logoUrl: '/assets/images/car-logos/jeep.jpg',
          modelCount: 9,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045349'),
          isActive: true,
        },
        {
          id: '61',
          name: 'Jensen',
          logoUrl: '/assets/images/car-logos/jensen.jpg',
          modelCount: 5,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045352'),
          isActive: true,
        },
        {
          id: '62',
          name: 'John-deere',
          logoUrl: '/assets/images/car-logos/john-deere.jpg',
          modelCount: 5,
          activeJobs: 17,
          lastUpdated: new Date('2025-01-30T13:34:46.045355'),
          isActive: true,
        },
        {
          id: '63',
          name: 'KGM',
          logoUrl: '/assets/images/car-logos/kgm.jpg',
          modelCount: 38,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045357'),
          isActive: true,
        },
        {
          id: '64',
          name: 'KIA',
          logoUrl: '/assets/images/car-logos/kia.jpg',
          modelCount: 35,
          activeJobs: 19,
          lastUpdated: new Date('2025-01-30T13:34:46.045360'),
          isActive: true,
        },
        {
          id: '65',
          name: 'KTM',
          logoUrl: '/assets/images/car-logos/ktm.jpg',
          modelCount: 6,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045362'),
          isActive: true,
        },
        {
          id: '66',
          name: 'Kubota',
          logoUrl: '/assets/images/car-logos/kubota.jpg',
          modelCount: 22,
          activeJobs: 15,
          lastUpdated: new Date('2025-01-30T13:34:46.045365'),
          isActive: true,
        },
        {
          id: '67',
          name: 'Lada',
          logoUrl: '/assets/images/car-logos/lada.jpg',
          modelCount: 17,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045368'),
          isActive: true,
        },
        {
          id: '68',
          name: 'Lamborghini',
          logoUrl: '/assets/images/car-logos/lamborghini.jpg',
          modelCount: 25,
          activeJobs: 19,
          lastUpdated: new Date('2025-01-30T13:34:46.045370'),
          isActive: true,
        },
        {
          id: '69',
          name: 'Lancia',
          logoUrl: '/assets/images/car-logos/lancia.jpg',
          modelCount: 20,
          activeJobs: 25,
          lastUpdated: new Date('2025-01-30T13:34:46.045373'),
          isActive: true,
        },
        {
          id: '70',
          name: 'Land Rover',
          logoUrl: '/assets/images/car-logos/land_rover.jpg',
          modelCount: 29,
          activeJobs: 6,
          lastUpdated: new Date('2025-01-30T13:34:46.045376'),
          isActive: true,
        },
        {
          id: '71',
          name: 'Leapmotor',
          logoUrl: '/assets/images/car-logos/leapmotor.jpg',
          modelCount: 16,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045379'),
          isActive: true,
        },
        {
          id: '72',
          name: 'LEVC',
          logoUrl: '/assets/images/car-logos/levc.jpg',
          modelCount: 44,
          activeJobs: 6,
          lastUpdated: new Date('2025-01-30T13:34:46.045382'),
          isActive: true,
        },
        {
          id: '73',
          name: 'Lexmoto',
          logoUrl: '/assets/images/car-logos/lexmoto.jpg',
          modelCount: 12,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045384'),
          isActive: true,
        },
        {
          id: '74',
          name: 'Lexus',
          logoUrl: '/assets/images/car-logos/lexus.jpg',
          modelCount: 28,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045387'),
          isActive: true,
        },
        {
          id: '75',
          name: 'Lincoln',
          logoUrl: '/assets/images/car-logos/lincoln.jpg',
          modelCount: 29,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045389'),
          isActive: true,
        },
        {
          id: '76',
          name: 'Belfast Taxis International',
          logoUrl: '/assets/images/car-logos/Belfast_taxis_international.jpg',
          modelCount: 49,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045392'),
          isActive: true,
        },
        {
          id: '77',
          name: 'Lotus',
          logoUrl: '/assets/images/car-logos/lotus.jpg',
          modelCount: 45,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045395'),
          isActive: true,
        },
        {
          id: '78',
          name: 'Mahindra',
          logoUrl: '/assets/images/car-logos/mahindra.jpg',
          modelCount: 37,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045398'),
          isActive: true,
        },
        {
          id: '79',
          name: 'MAN',
          logoUrl: '/assets/images/car-logos/man.jpg',
          modelCount: 19,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045401'),
          isActive: true,
        },
        {
          id: '80',
          name: 'Manitou',
          logoUrl: '/assets/images/car-logos/manitou.jpg',
          modelCount: 20,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045404'),
          isActive: true,
        },
        {
          id: '81',
          name: 'Maserati',
          logoUrl: '/assets/images/car-logos/maserati.jpg',
          modelCount: 28,
          activeJobs: 0,
          lastUpdated: new Date('2025-01-30T13:34:46.045406'),
          isActive: true,
        },
        {
          id: '82',
          name: 'Massey-ferguson',
          logoUrl: '/assets/images/car-logos/massey-ferguson.jpg',
          modelCount: 24,
          activeJobs: 15,
          lastUpdated: new Date('2025-01-30T13:34:46.045409'),
          isActive: true,
        },
        {
          id: '83',
          name: 'Maxus',
          logoUrl: '/assets/images/car-logos/maxus.jpg',
          modelCount: 30,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045412'),
          isActive: true,
        },
        {
          id: '84',
          name: 'Maybach',
          logoUrl: '/assets/images/car-logos/maybach.jpg',
          modelCount: 12,
          activeJobs: 24,
          lastUpdated: new Date('2025-01-30T13:34:46.045414'),
          isActive: true,
        },
        {
          id: '85',
          name: 'Mazda',
          logoUrl: '/assets/images/car-logos/mazda.jpg',
          modelCount: 26,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045417'),
          isActive: true,
        },
        {
          id: '86',
          name: 'McLaren',
          logoUrl: '/assets/images/car-logos/mclaren.jpg',
          modelCount: 47,
          activeJobs: 0,
          lastUpdated: new Date('2025-01-30T13:34:46.045419'),
          isActive: true,
        },
        {
          id: '87',
          name: 'Mercedes-Benz',
          logoUrl: '/assets/images/car-logos/mercedes-benz.jpg',
          modelCount: 23,
          activeJobs: 9,
          lastUpdated: new Date('2025-01-30T13:34:46.045422'),
          isActive: true,
        },
        {
          id: '88',
          name: 'MEV',
          logoUrl: '/assets/images/car-logos/mev.jpg',
          modelCount: 17,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045425'),
          isActive: true,
        },
        {
          id: '89',
          name: 'MG',
          logoUrl: '/assets/images/car-logos/mg.jpg',
          modelCount: 18,
          activeJobs: 7,
          lastUpdated: new Date('2025-01-30T13:34:46.045427'),
          isActive: true,
        },
        {
          id: '90',
          name: 'Micro',
          logoUrl: '/assets/images/car-logos/micro.jpg',
          modelCount: 42,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045432'),
          isActive: true,
        },
        {
          id: '91',
          name: 'Microcar',
          logoUrl: '/assets/images/car-logos/microcar.jpg',
          modelCount: 23,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045435'),
          isActive: true,
        },
        {
          id: '92',
          name: 'MINI',
          logoUrl: '/assets/images/car-logos/mini.jpg',
          modelCount: 24,
          activeJobs: 22,
          lastUpdated: new Date('2025-01-30T13:34:46.045437'),
          isActive: true,
        },
        {
          id: '93',
          name: 'Mitsubishi',
          logoUrl: '/assets/images/car-logos/mitsubishi.jpg',
          modelCount: 26,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045440'),
          isActive: true,
        },
        {
          id: '94',
          name: 'Mitsuoka',
          logoUrl: '/assets/images/car-logos/mitsuoka.jpg',
          modelCount: 25,
          activeJobs: 6,
          lastUpdated: new Date('2025-01-30T13:34:46.045443'),
          isActive: true,
        },
        {
          id: '95',
          name: 'MK',
          logoUrl: '/assets/images/car-logos/mk.jpg',
          modelCount: 8,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045446'),
          isActive: true,
        },
        {
          id: '96',
          name: 'Moke',
          logoUrl: '/assets/images/car-logos/moke.jpg',
          modelCount: 40,
          activeJobs: 14,
          lastUpdated: new Date('2025-01-30T13:34:46.045448'),
          isActive: true,
        },
        {
          id: '97',
          name: 'Morgan',
          logoUrl: '/assets/images/car-logos/morgan.jpg',
          modelCount: 14,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045451'),
          isActive: true,
        },
        {
          id: '98',
          name: 'Morris',
          logoUrl: '/assets/images/car-logos/morris.jpg',
          modelCount: 44,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045453'),
          isActive: true,
        },
        {
          id: '99',
          name: 'New-holland',
          logoUrl: '/assets/images/car-logos/new-holland.jpg',
          modelCount: 10,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045456'),
          isActive: true,
        },
        {
          id: '100',
          name: 'Nissan',
          logoUrl: '/assets/images/car-logos/nissan.jpg',
          modelCount: 40,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045459'),
          isActive: true,
        },
        {
          id: '101',
          name: 'NIU',
          logoUrl: '/assets/images/car-logos/niu.jpg',
          modelCount: 45,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045461'),
          isActive: true,
        },
        {
          id: '102',
          name: 'Noble',
          logoUrl: '/assets/images/car-logos/noble.jpg',
          modelCount: 24,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045464'),
          isActive: true,
        },
        {
          id: '103',
          name: 'Omoda',
          logoUrl: '/assets/images/car-logos/omoda.jpg',
          modelCount: 23,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045467'),
          isActive: true,
        },
        {
          id: '104',
          name: 'Opel',
          logoUrl: '/assets/images/car-logos/opel.jpg',
          modelCount: 16,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045470'),
          isActive: true,
        },
        {
          id: '105',
          name: 'Panther',
          logoUrl: '/assets/images/car-logos/panther.jpg',
          modelCount: 8,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045472'),
          isActive: true,
        },
        {
          id: '106',
          name: 'Perodua',
          logoUrl: '/assets/images/car-logos/perodua.jpg',
          modelCount: 10,
          activeJobs: 1,
          lastUpdated: new Date('2025-01-30T13:34:46.045475'),
          isActive: true,
        },
        {
          id: '107',
          name: 'Peugeot',
          logoUrl: '/assets/images/car-logos/peugeot.jpg',
          modelCount: 7,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045477'),
          isActive: true,
        },
        {
          id: '108',
          name: 'Polaris',
          logoUrl: '/assets/images/car-logos/polaris.jpg',
          modelCount: 9,
          activeJobs: 14,
          lastUpdated: new Date('2025-01-30T13:34:46.045480'),
          isActive: true,
        },
        {
          id: '109',
          name: 'Polestar',
          logoUrl: '/assets/images/car-logos/polestar.jpg',
          modelCount: 43,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045483'),
          isActive: true,
        },
        {
          id: '110',
          name: 'Pontiac',
          logoUrl: '/assets/images/car-logos/pontiac.jpg',
          modelCount: 28,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045485'),
          isActive: true,
        },
        {
          id: '111',
          name: 'Porsche',
          logoUrl: '/assets/images/car-logos/porsche.jpg',
          modelCount: 41,
          activeJobs: 12,
          lastUpdated: new Date('2025-01-30T13:34:46.045488'),
          isActive: true,
        },
        {
          id: '112',
          name: 'Proton',
          logoUrl: '/assets/images/car-logos/proton.jpg',
          modelCount: 11,
          activeJobs: 4,
          lastUpdated: new Date('2025-01-30T13:34:46.045491'),
          isActive: true,
        },
        {
          id: '113',
          name: 'Radical',
          logoUrl: '/assets/images/car-logos/radical.jpg',
          modelCount: 50,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045495'),
          isActive: true,
        },
        {
          id: '114',
          name: 'Reliant',
          logoUrl: '/assets/images/car-logos/reliant.jpg',
          modelCount: 10,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045497'),
          isActive: true,
        },
        {
          id: '115',
          name: 'Renault',
          logoUrl: '/assets/images/car-logos/renault.jpg',
          modelCount: 26,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045500'),
          isActive: true,
        },
        {
          id: '116',
          name: 'Rolls-Royce',
          logoUrl: '/assets/images/car-logos/rolls-royce.jpg',
          modelCount: 9,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045502'),
          isActive: true,
        },
        {
          id: '117',
          name: 'Rover',
          logoUrl: '/assets/images/car-logos/rover.jpg',
          modelCount: 27,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045505'),
          isActive: true,
        },
        {
          id: '118',
          name: 'Saab',
          logoUrl: '/assets/images/car-logos/saab.jpg',
          modelCount: 32,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045508'),
          isActive: true,
        },
        {
          id: '119',
          name: 'Scania',
          logoUrl: '/assets/images/car-logos/scania.jpg',
          modelCount: 47,
          activeJobs: 24,
          lastUpdated: new Date('2025-01-30T13:34:46.045510'),
          isActive: true,
        },
        {
          id: '120',
          name: 'SEAT',
          logoUrl: '/assets/images/car-logos/seat.jpg',
          modelCount: 42,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045513'),
          isActive: true,
        },
        {
          id: '121',
          name: 'Silence',
          logoUrl: '/assets/images/car-logos/silence.jpg',
          modelCount: 19,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045515'),
          isActive: true,
        },
        {
          id: '122',
          name: 'SKODA',
          logoUrl: '/assets/images/car-logos/skoda.jpg',
          modelCount: 25,
          activeJobs: 12,
          lastUpdated: new Date('2025-01-30T13:34:46.045518'),
          isActive: true,
        },
        {
          id: '123',
          name: 'Skywell',
          logoUrl: '/assets/images/car-logos/skywell.jpg',
          modelCount: 16,
          activeJobs: 8,
          lastUpdated: new Date('2025-01-30T13:34:46.045521'),
          isActive: true,
        },
        {
          id: '124',
          name: 'Smart',
          logoUrl: '/assets/images/car-logos/smart.jpg',
          modelCount: 20,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045523'),
          isActive: true,
        },
        {
          id: '125',
          name: 'Ssangyong',
          logoUrl: '/assets/images/car-logos/ssangyong.jpg',
          modelCount: 23,
          activeJobs: 11,
          lastUpdated: new Date('2025-01-30T13:34:46.045526'),
          isActive: true,
        },
        {
          id: '126',
          name: 'Subaru',
          logoUrl: '/assets/images/car-logos/subaru.jpg',
          modelCount: 25,
          activeJobs: 3,
          lastUpdated: new Date('2025-01-30T13:34:46.045528'),
          isActive: true,
        },
        {
          id: '127',
          name: 'Sunbeam',
          logoUrl: '/assets/images/car-logos/sunbeam.jpg',
          modelCount: 42,
          activeJobs: 15,
          lastUpdated: new Date('2025-01-30T13:34:46.045531'),
          isActive: true,
        },
        {
          id: '128',
          name: 'Super Soco',
          logoUrl: '/assets/images/car-logos/super_soco.jpg',
          modelCount: 48,
          activeJobs: 6,
          lastUpdated: new Date('2025-01-30T13:34:46.045534'),
          isActive: true,
        },
        {
          id: '129',
          name: 'Suzuki',
          logoUrl: '/assets/images/car-logos/suzuki.jpg',
          modelCount: 11,
          activeJobs: 24,
          lastUpdated: new Date('2025-01-30T13:34:46.045536'),
          isActive: true,
        },
        {
          id: '130',
          name: 'Takeuchi',
          logoUrl: '/assets/images/car-logos/takeuchi.jpg',
          modelCount: 38,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045539'),
          isActive: true,
        },
        {
          id: '131',
          name: 'Tesla',
          logoUrl: '/assets/images/car-logos/tesla.jpg',
          modelCount: 32,
          activeJobs: 13,
          lastUpdated: new Date('2025-01-30T13:34:46.045542'),
          isActive: true,
        },
        {
          id: '132',
          name: 'Thelmoco',
          logoUrl: '/assets/images/car-logos/thelmoco.jpg',
          modelCount: 18,
          activeJobs: 0,
          lastUpdated: new Date('2025-01-30T13:34:46.045544'),
          isActive: true,
        },
        {
          id: '133',
          name: 'Toyota',
          logoUrl: '/assets/images/car-logos/toyota.jpg',
          modelCount: 5,
          activeJobs: 21,
          lastUpdated: new Date('2025-01-30T13:34:46.045547'),
          isActive: true,
        },
        {
          id: '134',
          name: 'Triumph',
          logoUrl: '/assets/images/car-logos/triumph.jpg',
          modelCount: 33,
          activeJobs: 10,
          lastUpdated: new Date('2025-01-30T13:34:46.045550'),
          isActive: true,
        },
        {
          id: '135',
          name: 'TVR',
          logoUrl: '/assets/images/car-logos/tvr.jpg',
          modelCount: 13,
          activeJobs: 14,
          lastUpdated: new Date('2025-01-30T13:34:46.045552'),
          isActive: true,
        },
        {
          id: '136',
          name: 'Ultima',
          logoUrl: '/assets/images/car-logos/ultima.jpg',
          modelCount: 46,
          activeJobs: 20,
          lastUpdated: new Date('2025-01-30T13:34:46.045555'),
          isActive: true,
        },
        {
          id: '137',
          name: 'Vauxhall',
          logoUrl: '/assets/images/car-logos/vauxhall.jpg',
          modelCount: 9,
          activeJobs: 5,
          lastUpdated: new Date('2025-01-30T13:34:46.045558'),
          isActive: true,
        },
        {
          id: '138',
          name: 'Volkswagen',
          logoUrl: '/assets/images/car-logos/volkswagen.jpg',
          modelCount: 18,
          activeJobs: 16,
          lastUpdated: new Date('2025-01-30T13:34:46.045560'),
          isActive: true,
        },
        {
          id: '139',
          name: 'Volvo',
          logoUrl: '/assets/images/car-logos/volvo.jpg',
          modelCount: 26,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045563'),
          isActive: true,
        },
        {
          id: '140',
          name: 'Westfield',
          logoUrl: '/assets/images/car-logos/westfield.jpg',
          modelCount: 29,
          activeJobs: 24,
          lastUpdated: new Date('2025-01-30T13:34:46.045566'),
          isActive: true,
        },
        {
          id: '141',
          name: 'Yamaha',
          logoUrl: '/assets/images/car-logos/yamaha.jpg',
          modelCount: 50,
          activeJobs: 23,
          lastUpdated: new Date('2025-01-30T13:34:46.045568'),
          isActive: true,
        },
        {
          id: '142',
          name: 'Zenos',
          logoUrl: '/assets/images/car-logos/zenos.jpg',
          modelCount: 16,
          activeJobs: 15,
          lastUpdated: new Date('2025-01-30T13:34:46.045571'),
          isActive: true,
        },
        {
          id: '143',
          name: 'Zero',
          logoUrl: '/assets/images/car-logos/zero.jpg',
          modelCount: 18,
          activeJobs: 18,
          lastUpdated: new Date('2025-01-30T13:34:46.045573'),
          isActive: true,
        },
      ];

      // Initialize the data source with all manufacturers
      this.dataSource.data = [...this.allManufacturers];

      // Calculate total models
      this.totalModels = this.allManufacturers.reduce(
        (sum, make) => sum + make.modelCount,
        0
      );

      this.isLoading = false;
    }, 1000);
  }

  sortManufacturers(option: 'alphabetical' | 'mostUsed' | 'recent') {
    this.sortOption = option;
    const sortData = [...this.dataSource.data];

    switch (option) {
      case 'alphabetical':
        sortData.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'mostUsed':
        sortData.sort((a, b) => b.activeJobs - a.activeJobs);
        break;
      case 'recent':
        sortData.sort(
          (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()
        );
        break;
    }

    this.dataSource.data = sortData;
  }

  // Navigation
  viewModels(manufacturer: Manufacturer) {
    this.router.navigate(['/vehicles/models']);
  }

  // CRUD Operations
  addManufacturer() {
    this.dialogData = null;
    this.manufacturerForm.reset({ isActive: true });

    const dialogRef = this.dialog.open(this.addManufacturerDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.saveManufacturer();
      }
      this.dialogData = null;
    });
  }

  editManufacturer(manufacturer: Manufacturer, event: Event) {
    event.stopPropagation();

    this.dialogData = manufacturer;
    this.manufacturerForm.patchValue({
      name: manufacturer.name,
      logoUrl: manufacturer.logoUrl,
      isActive: manufacturer.isActive,
    });

    const dialogRef = this.dialog.open(this.addManufacturerDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.updateManufacturer(manufacturer.id);
      }
      this.dialogData = null;
    });
  }

  deleteManufacturer(manufacturer: Manufacturer, event: Event) {
    event.stopPropagation();
    this.manufacturerToDelete = manufacturer;

    const dialogRef = this.dialog.open(this.deleteConfirmDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmDelete();
      }
      this.manufacturerToDelete = null;
    });
  }

  saveManufacturer() {
    if (this.manufacturerForm.valid) {
      // Implement save logic
      console.log('Saving manufacturer:', this.manufacturerForm.value);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer added successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  updateManufacturer(id: string) {
    if (this.manufacturerForm.valid) {
      // Implement update logic
      console.log('Updating manufacturer:', id, this.manufacturerForm.value);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer updated successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  confirmDelete() {
    if (this.manufacturerToDelete) {
      // Implement delete logic
      console.log('Deleting manufacturer:', this.manufacturerToDelete.id);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer deleted successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  // Utility Methods
  private showSuccessMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
