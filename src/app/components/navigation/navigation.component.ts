import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    FormsModule, 
    NgbCollapseModule
  ],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent {
  isMenuCollapsed = true;
  searchQuery = '';
  isLoggedIn = false;

  onSearch(): void {
    console.log('Searching:', this.searchQuery);
  }

  login(): void {
    // Implement actual login logic here
    this.isLoggedIn = true;
  }

  logout(): void {
    // Implement actual logout logic here
    this.isLoggedIn = false;
  }
}