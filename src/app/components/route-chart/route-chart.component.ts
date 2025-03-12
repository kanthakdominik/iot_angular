import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-route-chart',
    standalone: true,
    templateUrl: './route-chart.component.html',
    styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit {
    routeId: string | null = null;

    constructor(private route: ActivatedRoute) { }

    ngOnInit() {
        this.routeId = this.route.snapshot.paramMap.get('id');
    }
}