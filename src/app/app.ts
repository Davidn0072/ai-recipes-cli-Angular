import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { newRecipeDialogConfig } from './pages/new-recipe/new-recipe-dialog.config';
import { NewRecipeDialogComponent } from './pages/new-recipe/new-recipe-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.sass',
})
export class App {
  private readonly dialog = inject(MatDialog);

  openNewRecipeDialog(): void {
    this.dialog.open(NewRecipeDialogComponent, newRecipeDialogConfig({}));
  }
}
