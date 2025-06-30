import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AppStateService {
  private isAuthPageSubject = new BehaviorSubject<boolean>(false);
  public isAuthPage$ = this.isAuthPageSubject.asObservable();

  constructor(private router: Router, private authService: AuthService) {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event: any) => {
      const isAuthPage = event.url.includes('/auth');
      this.isAuthPageSubject.next(isAuthPage);
    });
  }

  public isAuthPage(): Observable<boolean> {
    return this.isAuthPage$;
  }

  public hasSidebar(): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      const authSub = this.authService.isAuthenticated().subscribe((isAuth) => {
        const pageSub = this.isAuthPage$.subscribe((isAuthPage) => {
          observer.next(isAuth && !isAuthPage);

          return () => pageSub.unsubscribe();
        });
      });

      return () => authSub.unsubscribe();
    });
  }
}
