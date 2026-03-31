import type { MatDialogConfig } from '@angular/material/dialog';
import type { NewRecipeDialogData } from './new-recipe-dialog-data';

/** Shared layout for the add / edit recipe modal (similar footprint to the React modal). */
export function newRecipeDialogConfig(
  data: NewRecipeDialogData = {},
): MatDialogConfig<NewRecipeDialogData> {
  return {
    width: 'min(824px, calc(100vw - 32px))',
    maxWidth: '95vw',
    // Allow the dialog surface to grow with the taller form area (+85px); `position` unchanged.
    maxHeight: 'calc(90vh + 85px)',
    panelClass: 'new-recipe-dialog-panel',
    autoFocus: 'first-tabbable',
    closeOnNavigation: true,
    /** Places the dialog below the top of the viewport; offset above `5vh` (16px total). */
    position: { top: 'calc(5vh - 16px)' },
    data,
  };
}
