import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RadiationLevelService {
  static readonly legendItems = [
    { range: '≤ 0.02', color: '#005500' },
    { range: '0.03-0.04', color: '#007700' },
    { range: '0.05-0.06', color: '#009900' },
    { range: '0.07-0.08', color: '#00BB00' },
    { range: '0.09-0.10', color: '#00DD00' },
    { range: '0.11-0.12', color: '#88EE00' },
    { range: '0.13-0.14', color: '#EEEE00' },
    { range: '0.15-0.16', color: '#FFCC00' },
    { range: '0.17-0.18', color: '#FFAA00' },
    { range: '0.19-0.20', color: '#FF8800' },
    { range: '0.21-0.22', color: '#FF5500' },
    { range: '0.23-0.24', color: '#DD2200' },
    { range: '0.25-0.26', color: '#CC0000' },
    { range: '0.27-0.28', color: '#AA0000' },
    { range: '0.29-0.30', color: '#800000' },
    { range: '> 0.30', color: '#800000' }
  ];

  static getColorForUsv(usv: number): string {
    const levels = [
      { threshold: 0.02, color: '#005500' }, // Bardzo ciemny zielony
      { threshold: 0.04, color: '#007700' },
      { threshold: 0.06, color: '#009900' }, // Ciemny zielony
      { threshold: 0.08, color: '#00BB00' },
      { threshold: 0.10, color: '#00DD00' }, // Zielony
      { threshold: 0.12, color: '#88EE00' }, // Żółto-zielony
      { threshold: 0.14, color: '#EEEE00' }, // Żółty
      { threshold: 0.16, color: '#FFCC00' }, // Ciemny żółty
      { threshold: 0.18, color: '#FFAA00' }, // Jasny pomarańcz
      { threshold: 0.20, color: '#FF8800' }, // Pomarańczowy
      { threshold: 0.22, color: '#FF5500' }, // Ciemny pomarańcz
      { threshold: 0.24, color: '#DD2200' }, // Czerwono-pomarańczowy
      { threshold: 0.26, color: '#CC0000' }, // Czerwony
      { threshold: 0.28, color: '#AA0000' }, // Ciemny czerwony
      { threshold: 0.30, color: '#800000' }, // Bordowy
      { threshold: Infinity, color: '#800000' } // Max
    ];

    for (const level of levels) {
      if (usv <= level.threshold) {
        return level.color;
      }
    }

    return levels[levels.length - 1].color;
  }
}
