import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { catchError, finalize, of } from 'rxjs';
import { normalizeRecipe } from '../../models/recipe';
import { ApiService } from '../../services/api.service';
import { RecipeListRefreshService } from '../../services/recipe-list-refresh.service';
import type { NewRecipeDialogData } from './new-recipe-dialog-data';

type Difficulty = 'easy' | 'medium' | 'hard';

function parseIngredients(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function submitErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Network error';
}

function normalizeDifficulty(d?: string): Difficulty {
  const x = d?.toLowerCase();
  if (x === 'easy' || x === 'medium' || x === 'hard') return x;
  return 'easy';
}

@Component({
  selector: 'app-new-recipe-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogClose,
  ],
  templateUrl: './new-recipe-dialog.component.html',
  styleUrl: './new-recipe-dialog.component.sass',
})
export class NewRecipeDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly dialogRef = inject(MatDialogRef<NewRecipeDialogComponent>);
  private readonly dialogData =
    inject<NewRecipeDialogData | undefined>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly destroyRef = inject(DestroyRef);
  private readonly recipeListRefresh = inject(RecipeListRefreshService);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loadingRecipe = signal(false);

  readonly recipeId = signal<string | null>(this.initialRecipeId());

  private initialRecipeId(): string | null {
    const raw = this.dialogData.recipeId;
    if (raw == null || typeof raw !== 'string') return null;
    const t = raw.trim();
    return t !== '' ? t : null;
  }
  readonly isEditMode = computed(() => this.recipeId() != null && this.recipeId() !== '');

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    ingredientsText: [''],
    instructions: [''],
    difficulty: this.fb.nonNullable.control<Difficulty>('easy'),
    cooking_time: [0, Validators.min(0)],
  });

  constructor() {
    const id = this.recipeId();
    if (id) {
      this.loadRecipeById(id);
    } else {
      this.loadingRecipe.set(false);
      this.resetFormForCreate();
    }
  }

  private loadRecipeById(id: string): void {
    this.loadingRecipe.set(true);
    this.loadError.set(null);
    this.error.set(null);
    this.api
      .get<unknown>(`/recipes/${encodeURIComponent(id)}`)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.loadError.set(submitErrorMessage(err));
          return of(null);
        }),
        finalize(() => this.loadingRecipe.set(false)),
      )
      .subscribe((body) => {
        if (body == null) return;
        const r = normalizeRecipe(body);
        if (!r._id) {
          this.loadError.set('Recipe has no id.');
          return;
        }
        this.loadError.set(null);
        this.form.patchValue({
          title: r.title,
          ingredientsText: (r.ingredients ?? []).join('\n'),
          instructions: r.instructions ?? '',
          difficulty: normalizeDifficulty(r.difficulty),
          cooking_time: r.cooking_time ?? 0,
        });
      });
  }

  private resetFormForCreate(): void {
    this.form.reset({
      title: '',
      ingredientsText: '',
      instructions: '',
      difficulty: 'easy',
      cooking_time: 0,
    });
  }

  onSubmit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.recipeId();
    const v = this.form.getRawValue();
    const title = v.title.trim();
    if (!title) {
      this.error.set('Title is required.');
      return;
    }
    if (this.isEditMode() && !id) {
      this.error.set('Cannot update: missing recipe id.');
      return;
    }
    const rawTime = v.cooking_time;
    const cookingTime =
      typeof rawTime === 'number' && Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
    const payload = {
      title,
      ingredients: parseIngredients(v.ingredientsText),
      instructions: v.instructions.trim(),
      difficulty: v.difficulty,
      cooking_time: cookingTime,
    };
    this.submitting.set(true);
    const req =
      this.isEditMode() && id
        ? this.api.patch<unknown>(`/recipes/${encodeURIComponent(id)}`, payload)
        : this.api.postText('/recipes', payload);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.recipeListRefresh.notify();
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(submitErrorMessage(err));
      },
    });
  }

  fillExample(): void {
    this.error.set(null);
    this.form.patchValue({
      title: 'Quick tomato pasta',
      ingredientsText: ['spaghetti', 'olive oil', 'garlic', 'canned tomatoes', 'fresh basil'].join('\n'),
      instructions:
        'Cook pasta. Sauté garlic in oil, add tomatoes, simmer. Toss with pasta and basil.',
      difficulty: 'easy',
      cooking_time: 25,
    });
  }

  clearForm(): void {
    this.error.set(null);
    this.resetFormForCreate();
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
