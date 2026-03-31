import { Routes } from '@angular/router';
import { AboutPage } from './pages/about/about';
import { NewRecipePage } from './pages/new-recipe/new-recipe';
import { RecipeBoxPage } from './pages/recipe-box/recipe-box';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'recipe-box' },
  { path: 'recipe-box', component: RecipeBoxPage },
  { path: 'new-recipe', component: NewRecipePage },
  { path: 'about', component: AboutPage },
  { path: '**', redirectTo: 'recipe-box' },
];
