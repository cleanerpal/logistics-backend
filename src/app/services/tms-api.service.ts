import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

export enum FuelLevel {
  Empty = '1',
  Quarter = '2',
  Half = '3',
  ThreeQuarters = '4',
  Full = '5',
}

export interface AuthResponse {
  Response: {
    TokenId: string;
    LoginId: string;
    FirstName: string;
    LastName: string;
    Email: string;
    PreferredLanguage: string;
    PreferredCurrency: string;
    UserType: number;
    UserRole: number;
    Status: number;
  };
  Success: boolean;
  Errors: any;
}

export interface ApiResponse {
  Success: boolean;
  Errors: Array<{
    ErrorMessage: string;
    ControlId: string;
    ErrorType: number;
  }> | null;
}

export interface MovementRequest {
  regno: string;
  comment: string;
  mileage: string;
  fuelorevlevel: FuelLevel;
}

export interface CollectRequest extends MovementRequest {
  collectdate: string; // format: "DD-MMM-YYYY"
}

export interface DeliverRequest extends MovementRequest {
  delivereddate: string; // format: "DD-MMM-YYYY"
}

@Injectable({
  providedIn: 'root',
})
export class TmsApiService {
  private apiBaseUrl = 'https://tmsapi.reemaq.com';

  private authToken = new BehaviorSubject<string | null>(null);
  private loginId = 'VENDORNIVLAPI';
  private password = '6Gc!1Yj/5Yb!';

  constructor(private http: HttpClient) {
    // Try to get stored token on initialization
    const storedToken = localStorage.getItem('tms_auth_token');
    if (storedToken) {
      this.authToken.next(storedToken);
    }
  }

  /**
   * Authenticate with the TMS API
   */
  authenticate(): Observable<AuthResponse> {
    const url = `${this.apiBaseUrl}/UserAuthenticate`;
    const body = {
      loginId: this.loginId,
      password: this.password,
    };

    return this.http.post<AuthResponse>(url, body).pipe(
      tap((response) => {
        if (response.Success && response.Response.TokenId) {
          this.authToken.next(response.Response.TokenId);
          localStorage.setItem('tms_auth_token', response.Response.TokenId);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Check if we have an auth token
   */
  isAuthenticated(): boolean {
    return !!this.authToken.getValue();
  }

  /**
   * Get the current auth token
   */
  getAuthToken(): Observable<string | null> {
    return this.authToken.asObservable();
  }

  /**
   * Log out and clear the auth token
   */
  logout(): void {
    this.authToken.next(null);
    localStorage.removeItem('tms_auth_token');
  }

  /**
   * Record when a vehicle is collected
   */
  vehicleCollected(data: CollectRequest): Observable<ApiResponse> {
    const token = this.authToken.getValue();
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }

    const url = `${this.apiBaseUrl}/MovementCollect`;
    const body = {
      key: token,
      ...data,
    };

    return this.http
      .post<ApiResponse>(url, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * Record when a vehicle is delivered
   */
  vehicleDelivered(data: DeliverRequest): Observable<ApiResponse> {
    const token = this.authToken.getValue();
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }

    const url = `${this.apiBaseUrl}/MovementDeliver`;
    const body = {
      key: token,
      ...data,
    };

    return this.http
      .post<ApiResponse>(url, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * Record when a vehicle arrives at the compound
   */
  vehicleArrived(data: DeliverRequest): Observable<ApiResponse> {
    const token = this.authToken.getValue();
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }

    const url = `${this.apiBaseUrl}/VehicleArrived`;
    const body = {
      key: token,
      ...data,
    };

    return this.http
      .post<ApiResponse>(url, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * Record when a vehicle departs from the compound
   */
  vehicleDeparted(data: CollectRequest): Observable<ApiResponse> {
    const token = this.authToken.getValue();
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }

    const url = `${this.apiBaseUrl}/VehicleDeparted`;
    const body = {
      key: token,
      ...data,
    };

    return this.http
      .post<ApiResponse>(url, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * Format a date for the API (DD-MMM-YYYY)
   */
  formatApiDate(date: Date): string {
    const months = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];

    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  }

  /**
   * Error handler for HTTP requests
   */
  private handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      console.error('Client error:', error.error.message);
    } else {
      // Server-side error
      console.error(
        `Server returned code ${error.status}, ` +
          `body was: ${JSON.stringify(error.error)}`
      );
    }
    return throwError(
      () =>
        new Error(
          'Something went wrong with the API request. Please try again later.'
        )
    );
  }
}
