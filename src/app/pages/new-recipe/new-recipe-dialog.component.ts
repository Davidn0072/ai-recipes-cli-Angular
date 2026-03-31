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

const AI_SHORT_COST_NOTE =
  'Note: The recipe is intentionally short to reduce AI usage costs.';

function isShortDueToCostYes(v: unknown): boolean {
  if (v === true) return true;
  return typeof v === 'string' && v.trim().toLowerCase() === 'yes';
}

function appendShortDueToCostNote(instructions: string, append: boolean): string {
  if (!append) return instructions;
  const trimmed = instructions.trimEnd();
  if (trimmed.endsWith(AI_SHORT_COST_NOTE)) return instructions;
  if (!trimmed) return AI_SHORT_COST_NOTE;
  return `${trimmed}\n\n${AI_SHORT_COST_NOTE}`;
}

function aiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.error != null && typeof err.error === 'object') {
    const o = err.error as Record<string, unknown>;
    if (typeof o['message'] === 'string') return o['message'];
  }
  return submitErrorMessage(err);
}

const FILL_EXAMPLE_INSTRUCTIONS =
  '👋 Tip: click the purple "Generate with AI" button above — AI fills these steps for you ✨';

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

  private fillExampleHighlightTimer: ReturnType<typeof setTimeout> | null = null;

  readonly submitting = signal(false);
  readonly aiLoading = signal(false);
  /** First 5s after opening “New recipe” (matches React). */
  readonly fillExampleHighlight = signal(false);
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
    this.destroyRef.onDestroy(() => this.clearFillExampleHighlightTimer());

    const id = this.recipeId();
    if (id) {
      this.loadRecipeById(id);
    } else {
      this.loadingRecipe.set(false);
      this.resetFormForCreate();
      this.startFillExampleHighlight();
    }
  }

  private clearFillExampleHighlightTimer(): void {
    if (this.fillExampleHighlightTimer != null) {
      clearTimeout(this.fillExampleHighlightTimer);
      this.fillExampleHighlightTimer = null;
    }
  }

  private startFillExampleHighlight(): void {
    this.clearFillExampleHighlightTimer();
    this.fillExampleHighlight.set(true);
    this.fillExampleHighlightTimer = window.setTimeout(() => {
      this.fillExampleHighlightTimer = null;
      this.fillExampleHighlight.set(false);
    }, 5000);
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
    this.clearFillExampleHighlightTimer();
    this.fillExampleHighlight.set(false);
    this.form.patchValue({ instructions: FILL_EXAMPLE_INSTRUCTIONS });
  }

  clearForm(): void {
    this.error.set(null);
    this.clearFillExampleHighlightTimer();
    this.fillExampleHighlight.set(false);
    this.resetFormForCreate();
  }

  canUseAi(): boolean {
    const v = this.form.getRawValue();
    const title = v.title.trim();
    if (!title) return false;
    return parseIngredients(v.ingredientsText).length > 0;
  }

  generateWithAi(): void {
    const title = this.form.controls.title.value?.trim() ?? '';
    if (!title) {
      this.error.set('Add a title before requesting AI instructions.');
      return;
    }
    const ingredients = parseIngredients(this.form.controls.ingredientsText.value ?? '');
    if (ingredients.length === 0) {
      this.error.set('Add at least one ingredient before requesting AI instructions.');
      return;
    }
    this.error.set(null);
    this.aiLoading.set(true);
    this.api
      .post<Record<string, unknown>>('/recipes/generate', { title, ingredients })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.aiLoading.set(false)),
      )
      .subscribe({
        next: (data) => {
          const recipeText = typeof data['recipe'] === 'string' ? data['recipe'] : '';
          const diffRaw = typeof data['difficulty'] === 'string' ? data['difficulty'] : 'easy';
          const timeRaw = data['cooking_time'];
          const cookingNum =
            typeof timeRaw === 'number' && Number.isFinite(timeRaw)
              ? timeRaw
              : parseInt(String(timeRaw ?? '0'), 10) || 0;
          const shortDue = isShortDueToCostYes(data['short_due_to_cost']);
          const v = this.form.getRawValue();
          const mergedInstructions = recipeText.trim() || v.instructions;
          this.form.patchValue({
            instructions: appendShortDueToCostNote(mergedInstructions, shortDue),
            difficulty: normalizeDifficulty(diffRaw),
            cooking_time: cookingNum >= 0 ? cookingNum : v.cooking_time,
          });
        },
        error: (err) => {
          this.error.set(aiErrorMessage(err));
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
