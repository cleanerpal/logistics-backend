import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { FirebaseService } from '../services/firebase.service';
import { RoleService, UserRole } from '../services/role.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
):
  | Observable<boolean | UrlTree>
  | Promise<boolean | UrlTree>
  | boolean
  | UrlTree => {
  const firebaseService = inject(FirebaseService);
  const roleService = inject(RoleService);
  const router = inject(Router);

  return firebaseService.isAuthenticated().pipe(
    take(1),
    switchMap((isAuthenticated) => {
      if (!isAuthenticated) {
        // Store the attempted URL for redirecting after login
        return of(
          router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url },
          })
        );
      }

      // Check for required roles if specified
      const requiredRoles = route.data['roles'] as UserRole[];
      if (requiredRoles && requiredRoles.length > 0) {
        return roleService.getUserRole().pipe(
          map((userRole) => {
            if (!userRole || !requiredRoles.includes(userRole)) {
              // User doesn't have the required role, redirect to dashboard
              return router.createUrlTree(['/dashboard']);
            }
            return true;
          })
        );
      }

      return of(true);
    })
  );
};
