import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

@Component({
    selector: 'app-company-create',
    templateUrl: './company-create.component.html',
    styleUrl: './company-create.component.scss',
    standalone: false
})
export class CompanyCreateComponent implements OnInit {
  companyForm: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  companyId: string | null = null;

  // Phone number mask for consistent formatting
  phoneMask = [
    '(',
    /[1-9]/,
    /\d/,
    /\d/,
    ')',
    ' ',
    /\d/,
    /\d/,
    /\d/,
    '-',
    /\d/,
    /\d/,
    /\d/,
    /\d/,
  ];

  // Dropdown options
  industries = [
    'Technology',
    'Manufacturing',
    'Retail',
    'Healthcare',
    'Finance',
    'Education',
    'Construction',
    'Transportation',
    'Energy',
    'Other',
  ];

  companySizes = [
    'Small (1-50)',
    'Medium (51-250)',
    'Large (251-1000)',
    'Enterprise (1000+)',
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {
    this.companyForm = this.createForm();
  }

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.companyId;

    if (this.isEditMode) {
      this.loadCompanyData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      address: ['', [Validators.required]],
      driverName: ['', [Validators.required]],
      driverNumber: [
        '',
        [Validators.required, Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}$/)],
      ],
      driverEmail: ['', [Validators.required, Validators.email]],
      industry: ['', [Validators.required]],
      size: ['', [Validators.required]],
    });
  }

  private loadCompanyData(): void {
    // Simulate API call to get company data
    setTimeout(() => {
      const mockCompany = {
        name: 'Test Company',
        address: '123 Business St\nCity, State 12345',
        driverName: 'John Doe',
        driverNumber: '(555) 123-4567',
        driverEmail: 'john.doe@test.com',
        industry: 'Technology',
        size: 'Medium (51-250)',
      };

      this.companyForm.patchValue(mockCompany);
    }, 1000);
  }

  onSubmit(): void {
    if (this.companyForm.valid) {
      this.isSubmitting = true;

      // Simulate API call
      setTimeout(() => {
        console.log('Form submitted:', this.companyForm.value);
        this.isSubmitting = false;
        this.router.navigate(['/companies']);
      }, 1500);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
