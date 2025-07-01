import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';

export interface DvlaVehicleInfo {
  registrationNumber: string;
  make?: string;
  yearOfManufacture?: number;
  colour?: string;
  fuelType?: string;
  typeApproval?: string;
  wheelplan?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  markedForExport?: boolean;
  dateOfLastV5CIssued?: string;
  motStatus?: string;
  motExpiryDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
}

interface DvlaApiResponse {
  success: boolean;
  data?: DvlaVehicleInfo;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DvlaService {
  constructor(private fns: Functions) {}

  fetchVehicleDetails(registrationNumber: string): Observable<DvlaVehicleInfo> {
    const callable = httpsCallable(this.fns, 'getDvlaVehicleDetails');

    return new Observable((observer) => {
      const cleanedRegistration = registrationNumber.toUpperCase().replace(/\s/g, '');
      console.log('Service calling function with:', { registrationNumber: cleanedRegistration });

      callable({ registrationNumber: cleanedRegistration })
        .then((result) => {
          console.log('Service received result:', result);
          const data = result.data as DvlaApiResponse;

          if (data.success && data.data) {
            observer.next(data.data);
            observer.complete();
          } else {
            observer.error(new Error(data.error || 'Unknown error occurred'));
          }
        })
        .catch((error) => {
          console.error('Service callable error:', error);

          let errorMessage = 'Failed to retrieve vehicle details';

          if (error.code === 'not-found') {
            errorMessage = 'Vehicle not found in DVLA database';
          } else if (error.code === 'invalid-argument') {
            errorMessage = 'Invalid registration number format';
          } else if (error.code === 'unauthenticated') {
            errorMessage = 'Authentication required';
          } else if (error.code === 'unavailable') {
            errorMessage = 'DVLA service temporarily unavailable';
          } else if (error.code === 'permission-denied') {
            errorMessage = 'API access denied - check permissions';
          } else if (error.message) {
            errorMessage = error.message;
          }

          observer.error(new Error(errorMessage));
        });
    });
  }
}
