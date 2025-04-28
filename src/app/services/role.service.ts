import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirebaseService, User } from './firebase.service';

export type UserRole = 'SuperAdmin' | 'Admin' | 'Driver';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private firebaseService = inject(FirebaseService);

  // Get the current user's role
  getUserRole(): Observable<UserRole | null> {
    return this.firebaseService.user$.pipe(map((user) => user?.role || null));
  }

  // Check if user has a specific role
  hasRole(role: UserRole | UserRole[]): Observable<boolean> {
    return this.getUserRole().pipe(
      map((userRole) => {
        if (!userRole) return false;

        if (Array.isArray(role)) {
          return role.includes(userRole);
        }

        return role === userRole;
      })
    );
  }

  // Check if user is SuperAdmin
  isSuperAdmin(): Observable<boolean> {
    return this.hasRole('SuperAdmin');
  }

  // Check if user is Admin (includes SuperAdmin privileges)
  isAdmin(): Observable<boolean> {
    return this.hasRole(['Admin', 'SuperAdmin']);
  }

  // Check if user is Driver
  isDriver(): Observable<boolean> {
    return this.hasRole('Driver');
  }
}
