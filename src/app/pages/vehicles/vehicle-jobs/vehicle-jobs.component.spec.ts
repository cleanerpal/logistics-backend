import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleJobsComponent } from './vehicle-jobs.component';

describe('VehicleJobsComponent', () => {
  let component: VehicleJobsComponent;
  let fixture: ComponentFixture<VehicleJobsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleJobsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleJobsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
