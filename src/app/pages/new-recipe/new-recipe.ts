import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { normalizeRecipe } from '../../models/recipe';
import { ApiService } from '../../services/api.service';

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
  selector: 'app-new-recipe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-recipe.html',
  styleUrl: './new-recipe.sass',
})
export class NewRecipePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loadingRecipe = signal(false);

  readonly recipeId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.recipeId() != null && this.recipeId() !== '');

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    ingredientsText: [''],
    instructions: [''],
    difficulty: this.fb.nonNullable.control<Difficulty>('easy'),
    cooking_time: [0, Validators.min(0)],
  });

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get('recipeId')),
        switchMap((id) => {
          this.recipeId.set(id);
          this.loadError.set(null);
          this.error.set(null);
          if (!id) {
            this.loadingRecipe.set(false);
            this.resetFormForCreate();
            return of(null);
          }
          this.loadingRecipe.set(true);
          return this.api.get<unknown>(`/recipes/${encodeURIComponent(id)}`).pipe(
            catchError((err) => {
              this.loadError.set(submitErrorMessage(err));
              return of(null);
            }),
            finalize(() => this.loadingRecipe.set(false)),
          );
        }),
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
    const req = this.isEditMode() && id
      ? this.api.patch<unknown>(`/recipes/${encodeURIComponent(id)}`, payload)
      : this.api.postText('/recipes', payload);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/recipe-box']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(submitErrorMessage(err));
      },
    });
  }

  fillExample(): void {
    if (this.isEditMode()) return;
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
    const id = this.recipeId();
    if (id) {
      this.loadError.set(null);
      this.loadingRecipe.set(true);
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
          this.loadError.set(null);
          this.form.patchValue({
            title: r.title,
            ingredientsText: (r.ingredients ?? []).join('\n'),
            instructions: r.instructions ?? '',
            difficulty: normalizeDifficulty(r.difficulty),
            cooking_time: r.cooking_time ?? 0,
          });
        });
    } else {
      this.resetFormForCreate();
    }
  }
}
