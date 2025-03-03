import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RadiationLevelService {
  static readonly legendItems = [
    { range: '≤ 0.05', color: '#00FF00', label: 'Minimum Background' },
    { range: '0.06-0.09', color: '#80FF00', label: 'Very Low' },
    { range: '0.10-0.13', color: '#FFFF00', label: 'Normal Background' },
    { range: '0.14-0.19', color: '#FFBF00', label: 'Elevated' },
    { range: '0.20-0.25', color: '#FF7F00', label: 'Moderate' },
    { range: '0.26-0.29', color: '#FF0000', label: 'High' },
    { range: '0.30-0.35', color: '#BF0000', label: 'Very High' },
    { range: '0.36-0.41', color: '#400080', label: 'Extreme' },
    { range: '0.42-0.47', color: '#A000A0', label: 'Severe' },
    { range: '> 0.47', color: '#FF00FF', label: 'Dangerous' }
  ];

  static getColorForUsv(usv: number): string {
    const levels = [
      { threshold: 0.05, color: '#00FF00' },
      { threshold: 0.07, color: '#40FF00' },
      { threshold: 0.09, color: '#80FF00' },
      { threshold: 0.11, color: '#BFFF00' },
      { threshold: 0.13, color: '#FFFF00' },
      { threshold: 0.15, color: '#FFDF00' },
      { threshold: 0.17, color: '#FFBF00' },
      { threshold: 0.19, color: '#FF9F00' },
      { threshold: 0.21, color: '#FF7F00' },
      { threshold: 0.23, color: '#FF5F00' },
      { threshold: 0.25, color: '#FF3F00' },
      { threshold: 0.27, color: '#FF1F00' },
      { threshold: 0.29, color: '#FF0000' },
      { threshold: 0.31, color: '#DF0000' },
      { threshold: 0.33, color: '#BF0000' },
      { threshold: 0.35, color: '#9F0000' },
      { threshold: 0.37, color: '#7F0000' },
      { threshold: 0.39, color: '#5F0000' },
      { threshold: 0.41, color: '#400080' },
      { threshold: 0.43, color: '#600080' },
      { threshold: 0.45, color: '#800080' },
      { threshold: 0.47, color: '#A000A0' },
      { threshold: 0.49, color: '#C000C0' },
      { threshold: Infinity, color: '#FF00FF' }
    ];

    for (const level of levels) {
      if (usv <= level.threshold) {
        return level.color;
      }
    }

    return levels[levels.length - 1].color;
  }
}