import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SearchService } from '../../services/search.service';
import { UserInfo } from '../../models/login.model';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterLink, FormsModule, NgbCollapseModule],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent implements OnInit, OnDestroy {
  isMenuCollapsed = true;
  searchQuery = '';
  user: UserInfo | null = null;
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private searchService: SearchService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(this.authService.user$.subscribe(user => this.user = user));
    this.subscriptions.add(this.searchService.searchQuery$.subscribe(query => this.searchQuery = query));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSearch(): void {
    this.searchService.setSearchQuery(this.searchQuery);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: error => console.error('Logout failed:', error)
    });
  }
}
