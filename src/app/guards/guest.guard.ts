import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class GuestGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    return this.authService.isAuthenticated().pipe(
      take(1),
      map((isLoggedIn) => {
        if (!isLoggedIn) {
          return true;
        }

        // If user is logged in, redirect to dashboard or returnUrl if available
        const returnUrl = route.queryParams['returnUrl'] || '/dashboard';
        return this.router.createUrlTree([returnUrl]);
      })
    );
  }
}
