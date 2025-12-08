import { Route } from '@angular/router';
import { StreamControlDashboardComponent } from './features/stream-control-dashboard/stream-control-dashboard.component';

export const appRoutes: Route[] = [
    {
        path: '',
        component: StreamControlDashboardComponent
    }
];