import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleMovementComponent } from './vehicle-movement.component';

describe('VehicleMovementComponent', () => {
  let component: VehicleMovementComponent;
  let fixture: ComponentFixture<VehicleMovementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VehicleMovementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleMovementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
