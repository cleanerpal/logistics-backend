import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable, of, switchMap, take, map, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserPermissionKey } from '../interfaces/user-profile.interface';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    const requiredPermissions = route.data['permissions'] as string[];

    if (!requiredPermissions || requiredPermissions.length === 0) {
      console.warn('RoleGuard: No permissions specified in route data');
      return true;
    }

    return this.authService.isAuthenticated().pipe(
      take(1),
      switchMap((isLoggedIn) => {
        if (!isLoggedIn) {
          return of(
            this.router.createUrlTree(['/auth/sign-in'], {
              queryParams: { returnUrl: state.url },
            })
          );
        }

        // Check if admin (admins have all permissions)
        if (requiredPermissions.includes('isAdmin')) {
          return this.authService.isAdmin().pipe(
            map((isAdmin) => {
              if (isAdmin) {
                return true;
              } else {
                this.showAccessDenied();
                return this.router.createUrlTree(['/dashboard']);
              }
            })
          );
        }

        // Check for any required permission
        return this.authService.hasAnyPermission(requiredPermissions).pipe(
          map((hasPermission) => {
            if (hasPermission) {
              return true;
            } else {
              this.showAccessDenied();
              return this.router.createUrlTree(['/dashboard']);
            }
          }),
          catchError(() => {
            this.showAccessDenied();
            return of(this.router.createUrlTree(['/dashboard']));
          })
        );
      })
    );
  }

  private showAccessDenied(): void {
    this.snackBar.open(
      'You do not have permission to access this resource',
      'Dismiss',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
      }
    );
  }
}
