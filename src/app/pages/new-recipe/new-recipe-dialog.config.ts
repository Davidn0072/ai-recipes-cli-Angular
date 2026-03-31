import type { MatDialogConfig } from '@angular/material/dialog';
import type { NewRecipeDialogData } from './new-recipe-dialog-data';

/** Shared layout for the add / edit recipe modal (similar footprint to the React modal). */
export function newRecipeDialogConfig(
  data: NewRecipeDialogData = {},
): MatDialogConfig<NewRecipeDialogData> {
  return {
    width: 'min(824px, calc(100vw - 32px))',
    maxWidth: '95vw',
    maxHeight: '90vh',
    panelClass: 'new-recipe-dialog-panel',
    autoFocus: 'first-tabbable',
    closeOnNavigation: true,
    data,
  };
}
