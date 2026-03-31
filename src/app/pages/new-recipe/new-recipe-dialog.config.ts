import type { MatDialogConfig } from '@angular/material/dialog';
import type { NewRecipeDialogData } from './new-recipe-dialog-data';

/** Shared layout for the add / edit recipe modal (similar footprint to the React modal). */
export function newRecipeDialogConfig(
  data: NewRecipeDialogData = {},
): MatDialogConfig<NewRecipeDialogData> {
  return {
    width: 'min(824px, calc(100vw - 32px))',
    maxWidth: '95vw',
    // Allow the dialog surface to grow with the form scroll area (+125px vs base bump).
    maxHeight: 'calc(90vh + 125px)',
    panelClass: 'new-recipe-dialog-panel',
    autoFocus: 'first-tabbable',
    closeOnNavigation: true,
    /** Places the dialog below the top of the viewport; offset above `5vh` (16px total). */
    position: { top: 'calc(5vh - 16px)' },
    data,
  };
}
