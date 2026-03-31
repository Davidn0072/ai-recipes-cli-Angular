import { Routes } from '@angular/router';
import { AboutPage } from './pages/about/about';
import { RecipeBoxPage } from './pages/recipe-box/recipe-box';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'recipe-box' },
  { path: 'recipe-box', component: RecipeBoxPage },
  { path: 'about', component: AboutPage },
  { path: '**', redirectTo: 'recipe-box' },
];
